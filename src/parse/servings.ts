import type { ServingEntry } from '../domain/entries.js';
import { parseFusedAmount } from '../domain/quantity.js';
import { cell } from './columns.js';
import { issue, type ParseResult } from './issues.js';
import { parseRowFile, readPointEvent } from './rows.js';

export const SERVINGS_COLUMNS = ['Day', 'Time', 'Group', 'Food Name', 'Amount', 'Category'];

/**
 * `servings.csv` — one row per logged food. No nutrients and no gram weights, so
 * per-food nutrient attribution is impossible from this file (DATA_MODEL.md §7).
 *
 * Row order is preserved exactly as the file had it. DATA_MODEL.md §5 rule 4
 * warns that rows are not time-sorted — Snacks holds `7:30 PM` before `3:30 PM` —
 * and sorting here would hide that from anything that needs to know.
 */
export function parseServings(text: string, file = 'servings.csv'): ParseResult<ServingEntry> {
  return parseRowFile(text, file, SERVINGS_COLUMNS, (record, columns, issues) => {
    const spine = readPointEvent(record, columns, file);
    issues.push(...spine.issues);
    if (spine.event === undefined) return undefined;

    const amount = parseFusedAmount(cell(record, columns, 'Amount'));
    if (amount === undefined) {
      issues.push(
        issue(file, record.line, 'invalid-amount', 'not a number followed by a unit', 'Amount'),
      );
      return undefined;
    }

    return {
      ...spine.event,
      foodName: cell(record, columns, 'Food Name'),
      amount,
      category: cell(record, columns, 'Category'),
    };
  });
}
