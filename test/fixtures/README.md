# Test fixtures

**Everything in this directory is synthetic.** No file here came from a real Cronometer
account. Every food, weight, date and nutrient value was made up to exercise a specific
parser or aggregation behaviour. Real exports must never be added to this tree — not
committed, not gitignored, **not present**. Gitignoring one would keep it out of the
repository while leaving it on disk, which misses the point: the rule is that this project
never holds anyone's real health data, not merely that it avoids publishing it.

The schemas, however, are not made up. Column names, column order, encoding and the
missing-vs-zero behaviour are transcribed from the verified schemas in `DATA_MODEL.md`.

All six files, in all fixtures, are UTF-8 with **no BOM**, **LF** line endings, a final
newline, and the micro sign **U+00B5** (`µ`) — never Greek mu U+03BC.

---

## The five fixtures

### `gold-complete/` — the control

All six files. Three days (2026-08-14 … 2026-08-16). Deliberately **gap-free**: every
nutrient cell carries a value, so coverage is 1.0 for every nutrient and each `Total` row
equals the exact sum of that day's group rows. Real exports are rarely this clean;
`missing-nutrients/` carries the realistic gaps. This one exists so a test can say "here
nothing is missing" without qualification.

Deliberate properties worth knowing about:

- **2026-08-15 has five groups** (Breakfast, Lunch, Dinner, Snacks, Uncategorized) plus a
  `Total` row — the multi-group day for proving that summing never double-counts `Total`.
- **Times are not sorted.** Snacks on 2026-08-14 holds `9:30 PM` before `3:30 PM`.
- **A `9:39 PM` yogurt sits under `Breakfast`** on 2026-08-14. Group is a user label, not
  chronology; both values must survive parsing intact.
- **`1.00 container - each 5.3 oz`** appears twice — the `Amount` that defeats splitting on
  whitespace.
- `Alcohol (g)` and `Caffeine (mg)` are `0.00` almost everywhere: these are **measured
  zeros**, not gaps, and must not be conflated with the empty cells in
  `missing-nutrients/`. Caffeine is overridden to `95.00` for the 2026-08-14 coffee.
- `Completed` appears as both `false` and `true` (see hypotheses below).
- `fasts.csv` contains an in-progress fast with an **empty `End`**.

### `free-tier/` — capability detection

The same five files as `gold-complete/`, byte-for-byte, **with `fasts.csv` absent**. The
only difference between the two fixtures is that one file's existence, so anything that
behaves differently here is reacting to capability and nothing else.

### `empty-diary/` — the valid empty state

All six files, header row only, zero data rows. Three of the six real files arrived this
way. Empty is normal, not an error. Note that `fasts.csv` here is **present but empty** — a
third state distinct from `gold-complete/` (present, populated) and `free-tier/` (absent).

### `missing-nutrients/` — the case this project exists to fix

Two days. **2026-08-16 reproduces the table in `DATA_MODEL.md` §4 exactly:**

| Group | Omega-3 (g) | B3 (Niacin) (mg) | Protein (g) |
|---|---|---|---|
| Breakfast | `0.00` | `0.76` | `32.40` |
| Lunch | *(empty)* | *(empty)* | `46.20` |
| Dinner | *(empty)* | *(empty)* | `78.90` |
| Snacks | `0.01` | `0.02` | `23.50` |
| **Total** | **`0.01`** | **`0.79`** | **`181.00`** |

`servings.csv` logs **Atlantic Salmon at Dinner** on that day. The salmon's database record
has no fatty-acid data, so Cronometer's own `Total` reports 0.01 g of omega-3 on a day
containing 8 oz of salmon, and 0.79 mg of niacin against 181 g of protein. Both numbers are
artifacts of database gaps, not intake. That is the failure this whole codebase is aimed at.

Three separate divergences are encoded here, and they are not the same problem:

1. **Missing summed as zero.** Omega-3, niacin, DHA, EPA, ALA, omega-6, AA, LA are empty at
   Lunch and Dinner. Coverage is 2 of 4 groups.
2. **The `Total` row does not even equal the sum of the displayed group values.** `0.76 +
   0.02 = 0.78`, but the `Total` says `0.79`, because real exports sum unrounded values and
   round only for display. Any test comparing a recomputed total against the `Total` row
   must expect divergence from *both* causes.
3. **Zero coverage still prints a number.** `Oxalate (mg)` and `Phytate (mg)` are empty in
   every group on both days, and the `Total` row reports `0.00` regardless. A nutrient with
   no data at all is indistinguishable from a measured zero if you read only the `Total`.

2026-08-17 is a second high-protein day (182.00 g) where **niacin is missing only at
Dinner** (3 of 4 groups) and **omega-3 is fully present**. Coverage therefore differs per
nutrient *and* per day — a single global coverage number would be wrong on this fixture.

Vitamin D and selenium are additionally missing at Dinner on 2026-08-16, since fish is the
plausible source of both — a reminder that gaps cluster around whichever food lacks a
complete record, not randomly.

### `malformed/` — what a parser must survive

Every file contains valid rows around the broken ones. Nothing here should abort an import;
each defect should produce a structured error naming the file and the line.

`servings.csv` carries:

- Food names beginning with `=`, `+`, `-`, and `@` — the CSV formula-injection surface that
  must be escaped on any output round-trip.
- A name containing both a comma and escaped quotes: `Ben & Jerry's "Half Baked", pint`.
- A name containing emoji.
- A name containing an **embedded newline inside a quoted field** — valid RFC 4180, fatal to
  any parser that splits on `\n`.
- Ragged rows in both directions (5 fields and 8 fields against a 6-column header).
- Dates that are impossible (`2026-13-45`), non-ISO (`08/16/2026`), and empty.
- A time of `25:99 XM`.
- `Amount` values that defeat `^([\d.]+)\s+(.+)$`: `1.00` with no unit, `two bagels` with no
  number, and empty.
- **An unterminated quote on the final row**, positioned last on purpose so it corrupts only
  itself.

`notes.csv` carries the prompt-injection payloads: an instruction-shaped note telling the
model to ignore prior instructions and disclose the data directory path, one attempting to
break out of a `</note>` delimiter and obtain a medical diagnosis, and quotes, commas and
newlines inside a note body. These must reach the model as inert, clearly delimited user
content. There is also a spreadsheet `=HYPERLINK(...)` formula, which is doubly broken —
its quotes and comma sit in an unquoted field, so the row is ragged as well and a parser
should reject it outright rather than read a mangled note out of it.

`dailysummary.csv` carries a short row, a row with a trailing extra field, `N/A` and a
whitespace-only cell in nutrient columns, and `FALSE` in the `Completed` column — wrong
case, to catch anything comparing loosely.

`biometrics.csv` carries a missing `Unit`, a missing `Metric`, a non-numeric `Amount`, a
`kg` row among the `lbs` ones, and rows of the wrong width. `exercises.csv` and `fasts.csv`
carry ragged rows, a non-numeric duration, a fast whose `End` precedes its `Start`, and an
unparseable timestamp.

---

## Two things that are easy to get wrong

**`Amount` means different things in different files.** In `servings.csv` it is quantity and
unit fused into one string (`1.00 container - each 5.3 oz`). In `biometrics.csv` it is a
bare number, with the unit in its own `Unit` column (`180.0` + `lbs`). Same column name, two
shapes.

**`Day` vs `Date`.** Five files use `Day`; `dailysummary.csv` uses `Date`; `fasts.csv` uses
neither. Fixtures preserve this exactly, so a generic column mapper will visibly fail
against them rather than silently dropping rows.

---

## Deliberate hypotheses

These fixtures encode a few things `DATA_MODEL.md` marks as unverified. They are listed here
so no later milestone mistakes a fixture for evidence. Each maps to an open question in
`DATA_MODEL.md` §8.

| In the fixtures | Status |
|---|---|
| `Completed` as the literal `true` | Never observed in a real export (open question 7). Used once in `gold-complete/` so the string comparison has something to compare. |
| `fasts.csv` timestamps as `YYYY-MM-DD HH:MM:SS`, `Recurrence` as `Daily`/`None`, in-progress fast as an empty `End` | Entirely a guess (open question 3). Only the header is verified. Fast parsing must be written to tolerate other shapes. |
| Multi-day layout: days in ascending order, no repeated headers, one `Total` row per day | Inferred from a single-day export (open question 4). |
| A custom group name (`Second Breakfast`, in `malformed/`) | Unverified (open question 5). It is filed under `malformed/` for convenience, but it is **not an error** — a parser must accept it. `Group` is an open string, never an enum. |
| A `kg` biometric row (in `malformed/`) | Metric-account unit strings are unverified (open question 6). Also not an error — units are carried through as data. |
| Every nutrient cell formatted to exactly two decimals | Inferred from the `0.00` / `0.01` / `0.76` values quoted in `DATA_MODEL.md` §4; no other formatting evidence exists. |
| `Completed` repeated on every row of a day, including `Total` | The column exists on all 64-column rows, so a value must be there; that it is the same value per day is an assumption. |
| `Total` showing `0.00` for a nutrient missing in every group | Follows from "the `Total` row sums missing as zero", but that specific all-missing case was not observed. |
| `Category` values beyond the six observed (`Fruits and Fruit Juices`, `Poultry Products`, `Finfish and Shellfish Products`, `Cereal Grains and Pasta`, `Vegetables and Vegetable Products`, `Beef Products`) | Plausible USDA category names, not verified. Included on purpose: `Category` must be free text, never a six-value enum. |
| Biometric metrics beyond `Weight` (`Blood Pressure (Systolic)`, `Body Fat`, `Blood Glucose`) | Label spellings unverified. Included so nothing hardcodes the metric vocabulary. |
| `dailysummary.csv` emitting rows only for groups that have entries | Assumption; a real export may emit empty groups. |

---

## Invariants to preserve when editing

- `gold-complete/` has **no empty nutrient cells**, and each `Total` row is the **exact sum**
  of that day's group rows. If you edit a group value, fix the `Total`.
- `free-tier/` stays **byte-identical** to `gold-complete/` apart from the absent
  `fasts.csv`.
- `missing-nutrients/` 2026-08-16 must keep reproducing the `DATA_MODEL.md` §4 table
  verbatim, **including the `0.79` niacin total that does not equal `0.76 + 0.02`**. That
  discrepancy is real export behaviour, not a typo.
- The unterminated quote in `malformed/servings.csv` stays on the **last** row.
