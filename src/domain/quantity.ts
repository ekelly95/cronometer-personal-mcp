/**
 * A unit exactly as the export recorded it: `lbs`, `mg`, `container - each 5.3 oz`.
 *
 * Never normalised or converted. DATA_MODEL.md §3 notes that units reflect the
 * account's display preference rather than a canonical system — the same weight
 * exports as `180.0 lbs` here and `81.6 kg` on a metric account. Converting at
 * parse time would destroy the only record of what the user actually saw.
 */
export type Unit = string;

export interface Quantity {
  readonly value: number;
  readonly unit: Unit;
}

/**
 * DATA_MODEL.md §5 rule 3. `servings.csv` fuses quantity and unit into one cell,
 * and the unit itself contains digits, hyphens and spaces —
 * `1.00 container - each 5.3 oz`. Splitting on whitespace loses everything after
 * the first word, so the regex from the spec is used exactly as written.
 */
const FUSED_AMOUNT = /^([\d.]+)\s+(.+)$/;

export function parseFusedAmount(raw: string): Quantity | undefined {
  const match = FUSED_AMOUNT.exec(raw);
  if (match === null) return undefined;

  const numberText = match[1];
  const unit = match[2];
  if (numberText === undefined || unit === undefined) return undefined;

  // `[\d.]+` happily matches `1.2.3` and `...`, so the number still needs checking.
  const value = Number(numberText);
  if (!Number.isFinite(value)) return undefined;

  return { value, unit };
}
