/**
 * The single most important type in the project.
 *
 * DATA_MODEL.md §4: an empty nutrient cell means the food's database record has
 * no value for that nutrient. `0.00` means a measured zero. Cronometer's own
 * `Total` row collapses the two, which is how a day containing salmon comes to
 * report 0.01 g of omega-3.
 *
 * This is a discriminated union rather than `number | null` on purpose, and
 * CLAUDE.md names that as the reason TypeScript was chosen: a nullable number
 * invites `?? 0` at every call site, and one such default silently invents data.
 * There is nothing here to default.
 */

export interface Present {
  readonly kind: 'present';
  readonly value: number;
  /**
   * How many digits followed the decimal point in the source cell.
   *
   * Kept because M2 has to tell two kinds of divergence apart. The export
   * displays group values rounded but totals them unrounded, so `0.76 + 0.02`
   * legitimately reports `0.79`; the benign tolerance for that is
   * ±0.005 × groupCount *for a 2-decimal column*. Without the column's decimal
   * precision that tolerance cannot be computed, and rounding noise becomes
   * indistinguishable from the missing-as-zero signal that actually matters.
   * Do not drop this as redundant.
   */
  readonly decimals: number;
}

export interface Missing {
  readonly kind: 'missing';
}

/**
 * A number that may not have been recorded. Named generically because exercise
 * minutes and calories have exactly the same hazard as nutrients — `?? 0` there
 * would invent a workout of zero minutes rather than admit nothing was logged.
 */
export type MeasuredNumber = Present | Missing;

/** The name BUILD_PLAN.md uses. Same union; nutrients are the reason it exists. */
export type NutrientValue = MeasuredNumber;

export const MISSING: Missing = { kind: 'missing' };

export function present(value: number, decimals: number): Present {
  return { kind: 'present', value, decimals };
}

export function isPresent(value: MeasuredNumber): value is Present {
  return value.kind === 'present';
}

export function isMissing(value: MeasuredNumber): value is Missing {
  return value.kind === 'missing';
}

/**
 * Reading a cell has three outcomes, not two: a value, an absence, and text we
 * cannot interpret. `unreadable` is separated out so the caller has to decide
 * what to do about it — every caller records it as `Missing` and reports a
 * structured issue, which keeps coverage arithmetic honest while leaving a trace
 * of why the value is absent. Folding it into `Missing` here would lose that.
 */
export type MeasuredCell =
  | { readonly kind: 'present'; readonly value: Present }
  | { readonly kind: 'missing' }
  | { readonly kind: 'unreadable' };

/**
 * Deliberately strict. `Number()` accepts `''` as 0, `'0x10'` as 16 and
 * `'Infinity'` as infinity, any of which would fabricate data. Thousands
 * separators are rejected rather than guessed: `1,5` means one-point-five in a
 * metric locale and would silently read as fifteen.
 *
 * No leading sign. Every quantity read through here — a nutrient, a biometric
 * amount, exercise minutes and calories — is physically non-negative, so a
 * negative cell is a cell we cannot believe. Accepting one would let it subtract
 * from a subtotal while coverage still reported the day as complete, which is the
 * one way a wrong number could pass as a measured one.
 */
const DECIMAL = /^\d+(?:\.(\d+))?$/;

export function readMeasuredCell(raw: string): MeasuredCell {
  if (raw === '') return { kind: 'missing' };

  const match = DECIMAL.exec(raw);
  if (match === null) return { kind: 'unreadable' };

  const value = Number(raw);
  if (!Number.isFinite(value)) return { kind: 'unreadable' };

  return { kind: 'present', value: present(value, (match[1] ?? '').length) };
}
