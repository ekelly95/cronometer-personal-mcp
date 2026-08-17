import type { NoteEntry } from '../domain/entries.js';
import { cell } from './columns.js';
import type { ParseResult } from './issues.js';
import { parseRowFile, readPointEvent } from './rows.js';

export const NOTES_COLUMNS = ['Day', 'Time', 'Group', 'Note'];

/**
 * `notes.csv` — DATA_MODEL.md §3 calls `Note` the highest prompt-injection risk
 * in the dataset, being entirely user-authored text on its way to a model.
 *
 * It is stored verbatim all the same. Sanitising here would corrupt the user's
 * own words and would not help: a note is only dangerous at a boundary, and each
 * boundary needs its own treatment — escaped for CSV output, delimited as user
 * content for the model. Neutering the text at parse time would do both jobs
 * badly and lose the original.
 */
export function parseNotes(text: string, file = 'notes.csv'): ParseResult<NoteEntry> {
  return parseRowFile(text, file, NOTES_COLUMNS, (record, columns, issues) => {
    const spine = readPointEvent(record, columns, file);
    issues.push(...spine.issues);
    if (spine.event === undefined) return undefined;

    return { ...spine.event, note: cell(record, columns, 'Note') };
  });
}
