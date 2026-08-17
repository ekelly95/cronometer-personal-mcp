import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  FIXTURE_NAMES,
  fixtureDir,
  fixtureFiles,
  readFixture,
  readFixtureBytes,
  type FixtureName,
} from './support/fixtures.js';

// This suite tests the fixtures, not the code. It deliberately uses its own CSV
// reader and its own transcription of the schemas rather than importing from
// src/parse/ — otherwise a bug in the parser could mask a defect in the data the
// parser is validated against, and both suites would agree while both were wrong.

interface CsvScan {
  readonly records: readonly (readonly string[])[];
  readonly unterminatedQuote: boolean;
}

function scanCsv(text: string): CsvScan {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let started = false;
  let i = 0;

  while (i < text.length) {
    const c = text.charAt(i);
    if (inQuotes) {
      if (c === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"' && field === '') {
      inQuotes = true;
      started = true;
      i++;
      continue;
    }
    if (c === ',') {
      record.push(field);
      field = '';
      started = true;
      i++;
      continue;
    }
    if (c === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      started = false;
      i++;
      continue;
    }
    field += c;
    started = true;
    i++;
  }
  if (started || field !== '' || inQuotes) {
    record.push(field);
    records.push(record);
  }
  return { records, unterminatedQuote: inQuotes };
}

/** Array access that fails the test loudly instead of yielding undefined. */
function at<T>(items: readonly T[], index: number, what: string): T {
  const value = items[index];
  if (value === undefined) throw new Error(`missing ${what} at index ${index}`);
  return value;
}

// Built from codepoints on purpose: U+00B5 and U+03BC are visually identical, so
// character literals here would be unreviewable.
const MU = String.fromCharCode(0x00b5); // MICRO SIGN — the one Cronometer uses
const GREEK_MU = String.fromCharCode(0x03bc); // GREEK SMALL LETTER MU — must never appear

// Transcribed from DATA_MODEL.md section 3.
const NUTRIENT_COLUMNS = [
  'Energy (kcal)', 'Alcohol (g)', 'Caffeine (mg)', 'Oxalate (mg)', 'Phytate (mg)', 'Water (g)',
  'B1 (Thiamine) (mg)', 'B2 (Riboflavin) (mg)', 'B3 (Niacin) (mg)', 'B5 (Pantothenic Acid) (mg)',
  'B6 (Pyridoxine) (mg)', `B12 (Cobalamin) (${MU}g)`, `Folate (${MU}g)`, `Vitamin A (${MU}g)`,
  'Vitamin C (mg)', 'Vitamin D (IU)', 'Vitamin E (mg)', `Vitamin K (${MU}g)`,
  'Calcium (mg)', 'Copper (mg)', 'Iron (mg)', 'Magnesium (mg)', 'Manganese (mg)',
  'Phosphorus (mg)', 'Potassium (mg)', `Selenium (${MU}g)`, 'Sodium (mg)', 'Zinc (mg)',
  'Net Carbs (g)', 'Carbs (g)', 'Fiber (g)', 'Insoluble Fiber (g)', 'Soluble Fiber (g)',
  'Starch (g)', 'Sugars (g)', 'Added Sugars (g)',
  'Fat (g)', 'Cholesterol (mg)', 'Monounsaturated (g)', 'Polyunsaturated (g)', 'Saturated (g)',
  'Trans-Fats (g)', 'Omega-3 (g)', 'ALA (g)', 'DHA (g)', 'EPA (g)', 'Omega-6 (g)', 'AA (g)',
  'LA (g)',
  'Cystine (g)', 'Histidine (g)', 'Isoleucine (g)', 'Leucine (g)', 'Lysine (g)', 'Methionine (g)',
  'Phenylalanine (g)', 'Protein (g)', 'Threonine (g)', 'Tryptophan (g)', 'Tyrosine (g)',
  'Valine (g)',
] as const;

const EXPECTED_HEADERS: Record<string, readonly string[]> = {
  'servings.csv': ['Day', 'Time', 'Group', 'Food Name', 'Amount', 'Category'],
  'dailysummary.csv': ['Date', 'Group', ...NUTRIENT_COLUMNS, 'Completed'],
  'biometrics.csv': ['Day', 'Time', 'Group', 'Metric', 'Unit', 'Amount'],
  'exercises.csv': ['Day', 'Time', 'Group', 'Exercise', 'Minutes', 'Calories Burned'],
  'notes.csv': ['Day', 'Time', 'Group', 'Note'],
  'fasts.csv': ['Name', 'Start', 'End', 'Recurrence', 'Comments'],
};

const ALL_SIX = [
  'biometrics.csv',
  'dailysummary.csv',
  'exercises.csv',
  'fasts.csv',
  'notes.csv',
  'servings.csv',
];

/** Fixtures whose every row is expected to conform to its header. */
const WELL_FORMED: readonly FixtureName[] = [
  'gold-complete',
  'free-tier',
  'empty-diary',
  'missing-nutrients',
];

const csvFilesOf = (name: FixtureName): string[] =>
  fixtureFiles(name).filter((f) => f.endsWith('.csv'));

const cents = (v: string): number => Math.round(Number(v) * 100);

/** Position of a nutrient in dailysummary.csv: two spine columns, then nutrients. */
function columnIndex(name: string): number {
  const index = (NUTRIENT_COLUMNS as readonly string[]).indexOf(name);
  if (index < 0) throw new Error(`unknown nutrient column: ${name}`);
  return 2 + index;
}

function dailySummaryRows(fixture: FixtureName): readonly (readonly string[])[] {
  return scanCsv(readFixture(fixture, 'dailysummary.csv')).records.slice(1);
}

// ---------------------------------------------------------------------------

describe('the schemas this suite checks against', () => {
  it('has 61 nutrient columns and 64 dailysummary columns', () => {
    expect(NUTRIENT_COLUMNS).toHaveLength(61);
    expect(EXPECTED_HEADERS['dailysummary.csv']).toHaveLength(64);
  });
});

describe('fixture inventory', () => {
  it.each([...FIXTURE_NAMES])('%s/ exists', (name) => {
    expect(existsSync(fixtureDir(name)) && statSync(fixtureDir(name)).isDirectory()).toBe(true);
  });

  it('gold-complete, empty-diary, missing-nutrients and malformed carry all six files', () => {
    for (const name of ['gold-complete', 'empty-diary', 'missing-nutrients', 'malformed'] as const) {
      expect(csvFilesOf(name), name).toEqual(ALL_SIX);
    }
  });

  it('free-tier is gold-complete without fasts.csv — the only difference', () => {
    expect(csvFilesOf('free-tier')).toEqual(ALL_SIX.filter((f) => f !== 'fasts.csv'));
    for (const file of csvFilesOf('free-tier')) {
      expect(readFixtureBytes('free-tier', file).equals(readFixtureBytes('gold-complete', file)), file)
        .toBe(true);
    }
  });
});

describe('encoding', () => {
  for (const name of FIXTURE_NAMES) {
    for (const file of csvFilesOf(name)) {
      it(`${name}/${file} is UTF-8 without BOM, LF-only, with a final newline`, () => {
        const bytes = readFixtureBytes(name, file);
        const text = readFixture(name, file);
        expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false);
        expect(text).not.toContain('\r');
        expect(text.endsWith('\n')).toBe(true);
      });

      it(`${name}/${file} uses U+00B5 for the micro sign, never U+03BC`, () => {
        expect(readFixture(name, file)).not.toContain(GREEK_MU);
      });
    }
  }

  it('the micro sign actually appears, so the check above is not vacuous', () => {
    const header = readFixture('gold-complete', 'dailysummary.csv').split('\n')[0] ?? '';
    expect(header).toContain(`Selenium (${MU}g)`);
    expect(header.match(new RegExp(MU, 'g'))).toHaveLength(5);
  });
});

describe('headers match DATA_MODEL.md exactly', () => {
  for (const name of FIXTURE_NAMES) {
    for (const file of csvFilesOf(name)) {
      it(`${name}/${file}`, () => {
        const text = readFixture(name, file);
        const headerLine = text.slice(0, text.indexOf('\n'));
        const header = at(scanCsv(`${headerLine}\n`).records, 0, 'header row');
        expect(header).toEqual(EXPECTED_HEADERS[file]);
      });
    }
  }
});

describe('well-formed fixtures have no ragged rows', () => {
  for (const name of WELL_FORMED) {
    for (const file of csvFilesOf(name)) {
      it(`${name}/${file}`, () => {
        const expected = EXPECTED_HEADERS[file]?.length;
        const { records, unterminatedQuote } = scanCsv(readFixture(name, file));
        expect(unterminatedQuote).toBe(false);
        const widths = new Set(records.map((r) => r.length));
        expect([...widths]).toEqual([expected]);
      });
    }
  }
});

describe('gold-complete — the control fixture', () => {
  const rows = dailySummaryRows('gold-complete');
  const byDate = new Map<string, (readonly string[])[]>();
  for (const row of rows) {
    const date = at(row, 0, 'Date');
    const existing = byDate.get(date) ?? [];
    existing.push(row);
    byDate.set(date, existing);
  }

  it('covers three days', () => {
    expect(byDate.size).toBe(3);
  });

  it('has no empty nutrient cell anywhere — coverage is 1.0 by construction', () => {
    const empties = rows.flatMap((row, r) =>
      row.flatMap((cell, c) => (cell === '' ? [`row ${r} column ${c}`] : [])),
    );
    expect(empties).toEqual([]);
  });

  it('gives every day exactly one Total row', () => {
    for (const [date, dayRows] of byDate) {
      expect(dayRows.filter((r) => r[1] === 'Total'), date).toHaveLength(1);
    }
  });

  it("Total equals the exact sum of that day's group rows, for all 61 nutrients", () => {
    const mismatches: string[] = [];
    for (const [date, dayRows] of byDate) {
      const total = dayRows.find((r) => r[1] === 'Total');
      const groups = dayRows.filter((r) => r[1] !== 'Total');
      if (total === undefined) throw new Error(`${date} has no Total row`);
      NUTRIENT_COLUMNS.forEach((nutrient, n) => {
        const column = 2 + n;
        const summed = groups.reduce((acc, r) => acc + cents(at(r, column, nutrient)), 0);
        const reported = cents(at(total, column, nutrient));
        if (summed !== reported) mismatches.push(`${date} ${nutrient}: ${summed} vs ${reported}`);
      });
    }
    expect(mismatches).toEqual([]);
  });

  it('has a five-group day, for proving that summing never double-counts Total', () => {
    const groups = (byDate.get('2026-08-15') ?? []).filter((r) => r[1] !== 'Total').map((r) => r[1]);
    expect(groups).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Uncategorized']);
  });

  it("exercises both of Completed's string literals", () => {
    const values = new Set(rows.map((r) => at(r, 63, 'Completed')));
    expect(values).toEqual(new Set(['true', 'false']));
  });

  it('records measured zeros, which are not the same thing as empty cells', () => {
    const alcohol = columnIndex('Alcohol (g)');
    expect(rows.every((r) => at(r, alcohol, 'Alcohol') === '0.00')).toBe(true);
  });

  it('holds the entries the parser acceptance tests depend on', () => {
    const servings = readFixture('gold-complete', 'servings.csv');
    // A 9:39 PM entry filed under Breakfast: Group is a user label, not chronology.
    expect(servings).toContain('2026-08-14,9:39 PM,Breakfast,');
    // An Amount that defeats splitting on whitespace.
    expect(servings).toContain('1.00 container - each 5.3 oz');
    // Times out of order within a group: Snacks holds 9:30 PM before 3:30 PM.
    const snackTimes = servings
      .split('\n')
      .filter((l) => l.startsWith('2026-08-14,') && l.includes(',Snacks,'))
      .map((l) => at(l.split(','), 1, 'Time'));
    expect(snackTimes).toEqual(['9:30 PM', '3:30 PM']);
  });

  it('records a biometric with an empty Time, and one fast still in progress', () => {
    expect(readFixture('gold-complete', 'biometrics.csv')).toContain(
      '2026-08-14,,Uncategorized,Weight,lbs,180.0',
    );
    expect(readFixture('gold-complete', 'fasts.csv')).toContain(
      'Current fast,2026-08-16 20:30:00,,None,',
    );
  });
});

describe('empty-diary — the valid empty state', () => {
  it.each(ALL_SIX)('%s holds a header and nothing else', (file) => {
    expect(scanCsv(readFixture('empty-diary', file)).records).toHaveLength(1);
  });
});

describe('missing-nutrients — the case this project exists to fix', () => {
  const rows = dailySummaryRows('missing-nutrients');
  const day = (date: string) => rows.filter((r) => r[0] === date);
  const groupsOf = (date: string) => day(date).filter((r) => r[1] !== 'Total');
  const totalOf = (date: string) => {
    const total = day(date).find((r) => r[1] === 'Total');
    if (total === undefined) throw new Error(`no Total row for ${date}`);
    return total;
  };

  const OMEGA3 = columnIndex('Omega-3 (g)');
  const NIACIN = columnIndex('B3 (Niacin) (mg)');
  const PROTEIN = columnIndex('Protein (g)');
  const OXALATE = columnIndex('Oxalate (mg)');

  describe('2026-08-16 reproduces the DATA_MODEL.md section 4 table verbatim', () => {
    const groups = groupsOf('2026-08-16');
    const total = totalOf('2026-08-16');

    it('has four groups and a Total', () => {
      expect(groups.map((r) => r[1])).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snacks']);
    });

    it('omega-3 reads 0.00, empty, empty, 0.01 — a measured zero and two gaps', () => {
      expect(groups.map((r) => r[OMEGA3])).toEqual(['0.00', '', '', '0.01']);
    });

    it("omega-3's Total reports 0.01 g on a day containing 8 oz of salmon", () => {
      expect(total[OMEGA3]).toBe('0.01');
      expect(readFixture('missing-nutrients', 'servings.csv')).toContain(
        '2026-08-16,7:20 PM,Dinner,"Atlantic Salmon, Baked",8.00 oz',
      );
    });

    it('niacin reads 0.76, empty, empty, 0.02 with a Total of 0.79', () => {
      expect(groups.map((r) => r[NIACIN])).toEqual(['0.76', '', '', '0.02']);
      expect(total[NIACIN]).toBe('0.79');
    });

    it('the niacin Total diverges from the sum of the displayed group values', () => {
      // 0.76 + 0.02 = 0.78, not 0.79. Real exports sum unrounded values and round
      // only for display, so M2 must classify this rounding divergence separately
      // from the missing-as-zero one below.
      const summed = groups.reduce((acc, r) => {
        const cell = at(r, NIACIN, 'niacin');
        return acc + (cell === '' ? 0 : cents(cell));
      }, 0);
      expect(summed).toBe(78);
      expect(cents(at(total, NIACIN, 'niacin total'))).toBe(79);
    });

    it('is a high-protein day: 181.00 g, with every group reporting', () => {
      expect(groups.map((r) => r[PROTEIN])).toEqual(['32.40', '46.20', '78.90', '23.50']);
      expect(total[PROTEIN]).toBe('181.00');
    });

    it('reports 0.00 for a nutrient no group recorded at all', () => {
      // Zero coverage is indistinguishable from a measured zero if you read only
      // the Total row. This is the worst case of the same bug.
      expect(groups.map((r) => r[OXALATE])).toEqual(['', '', '', '']);
      expect(total[OXALATE]).toBe('0.00');
    });
  });

  describe('2026-08-17 varies coverage, so no single global number can describe it', () => {
    const groups = groupsOf('2026-08-17');

    it('is missing niacin in one group where the previous day was missing two', () => {
      expect(groups.filter((r) => r[NIACIN] !== '')).toHaveLength(3);
      expect(groupsOf('2026-08-16').filter((r) => r[NIACIN] !== '')).toHaveLength(2);
    });

    it('has full omega-3 coverage where the previous day had half', () => {
      expect(groups.every((r) => r[OMEGA3] !== '')).toBe(true);
    });

    it('is also a high-protein day, at 182.00 g', () => {
      expect(totalOf('2026-08-17')[PROTEIN]).toBe('182.00');
    });
  });
});

describe('malformed — what a parser has to survive', () => {
  const servings = scanCsv(readFixture('malformed', 'servings.csv'));
  const rows = servings.records.slice(1);
  const names = rows.map((r) => r[3] ?? '');
  const notes = readFixture('malformed', 'notes.csv');

  it('has a food name beginning with each of = + - @', () => {
    for (const lead of ['=', '+', '-', '@']) {
      expect(names.some((n) => n.startsWith(lead)), lead).toBe(true);
    }
  });

  it('has a food name containing both a comma and escaped quotes', () => {
    expect(names).toContain('Ben & Jerry\'s "Half Baked", pint');
  });

  it('has a food name containing emoji', () => {
    expect(names.some((n) => /\p{Extended_Pictographic}/u.test(n))).toBe(true);
  });

  it('has a food name containing a newline inside a quoted field', () => {
    expect(names.some((n) => n.includes('\n'))).toBe(true);
  });

  it('has ragged rows in both directions', () => {
    expect(rows.some((r) => r.length < 6)).toBe(true);
    expect(rows.some((r) => r.length > 6)).toBe(true);
  });

  it('has impossible, non-ISO and empty dates', () => {
    const days = rows.map((r) => r[0]);
    expect(days).toContain('2026-13-45');
    expect(days).toContain('08/16/2026');
    expect(days).toContain('');
  });

  it('has an impossible time', () => {
    expect(rows.map((r) => r[1])).toContain('25:99 XM');
  });

  it('has Amounts that defeat the number-space-unit rule', () => {
    const amounts = rows.map((r) => r[4]);
    expect(amounts).toContain('1.00'); // no unit
    expect(amounts).toContain('two bagels'); // no number
    expect(amounts).toContain(''); // nothing at all
  });

  it('ends with an unterminated quote, so it corrupts only itself', () => {
    expect(servings.unterminatedQuote).toBe(true);
    expect(names).toContain('Valid Row After The Broken Ones');
  });

  it('has a custom diary group — unverified, but not an error', () => {
    expect(rows.map((r) => r[2])).toContain('Second Breakfast');
  });

  it('has notes shaped like instructions to a language model', () => {
    expect(notes).toMatch(/ignore all previous instructions/i);
    expect(notes).toMatch(/<\/note><\/user_data>/);
    expect(notes).toMatch(/path of the data directory/i);
  });

  it('has a dailysummary with ragged rows and unreadable nutrient cells', () => {
    const ds = scanCsv(readFixture('malformed', 'dailysummary.csv')).records.slice(1);
    expect(ds.some((r) => r.length < 64)).toBe(true);
    expect(ds.some((r) => r.length > 64)).toBe(true);
    expect(ds.some((r) => r.includes('N/A'))).toBe(true);
    expect(ds.some((r) => r.includes(' '))).toBe(true);
    expect(ds.some((r) => r.includes('FALSE'))).toBe(true);
  });

  it('has biometric rows with a missing Unit, a missing Metric and a non-numeric Amount', () => {
    const bio = scanCsv(readFixture('malformed', 'biometrics.csv')).records.slice(1);
    expect(bio.some((r) => r[4] === '' && r[3] !== '')).toBe(true);
    expect(bio.some((r) => r[3] === '')).toBe(true);
    expect(bio.some((r) => r[5] === 'not a number')).toBe(true);
  });

  it('has a fast whose End precedes its Start, and one with no End at all', () => {
    const fasts = scanCsv(readFixture('malformed', 'fasts.csv')).records.slice(1);
    expect(fasts.some((r) => r[1] === '2026-08-16 20:00:00' && r[2] === '2026-08-16 08:00:00'))
      .toBe(true);
    expect(fasts.some((r) => r[2] === '')).toBe(true);
  });
});

describe('no real data', () => {
  it('every fixture file is one of the six known export shapes', () => {
    for (const name of FIXTURE_NAMES) {
      for (const file of csvFilesOf(name)) {
        expect(ALL_SIX, `${name}/${file}`).toContain(file);
      }
    }
  });
});
