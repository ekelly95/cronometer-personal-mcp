/**
 * A diary group as the user labelled it: `Breakfast`, `Snacks`, `Uncategorized`.
 *
 * A plain string, never an enum. DATA_MODEL.md §3 marks custom group names as
 * unverified, and §6 records that building against one account's assumptions is
 * exactly what made an earlier implementation break for other users. A closed set
 * here would reject real diaries.
 *
 * DATA_MODEL.md §5 rule 6: a group is a label, not a time of day. A 9:39 PM entry
 * filed under `Breakfast` is ordinary. Nothing may infer time from this.
 */
export type DiaryGroup = string;

/** Observed in a real export. Useful for display ordering; not a validation set. */
export const KNOWN_DIARY_GROUPS = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'Snacks',
  'Uncategorized',
] as const;

/**
 * `dailysummary.csv` puts a per-day aggregate in the same column as the diary
 * groups. It is not a group, and DATA_MODEL.md §5 rule 1 requires filtering it
 * out before summing or every day double-counts.
 *
 * A user could in principle name a custom group `Total`; there is no way to tell
 * the two apart from the CSV, and the spec's rule is followed as written.
 */
export const TOTAL_ROW_LABEL = 'Total';

/**
 * DATA_MODEL.md §5 rule 2: `Completed` is a string, and `'false'` is truthy in
 * JavaScript. Modelled as a three-way string union rather than a boolean so
 * there is no truthiness to get wrong, and so an unrecognised value is visible
 * instead of quietly becoming `false`.
 */
export type Completed = 'complete' | 'incomplete' | 'unrecognised';

export function readCompleted(raw: string): Completed {
  if (raw === 'true') return 'complete';
  if (raw === 'false') return 'incomplete';
  return 'unrecognised';
}
