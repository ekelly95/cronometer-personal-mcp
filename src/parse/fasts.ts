import { parseLocalTimestamp } from '../domain/calendar.js';
import type { FastInterval } from '../domain/entries.js';
import { cell } from './columns.js';
import type { ParseResult } from './issues.js';
import { parseRowFile } from './rows.js';

export const FASTS_COLUMNS = ['Name', 'Start', 'End', 'Recurrence', 'Comments'];

/**
 * `fasts.csv` — the one interval in the dataset, and the least verified file in
 * it. DATA_MODEL.md §8 question 3: beyond the header, the `Start`/`End` format,
 * the `Recurrence` grammar and how an in-progress fast is represented are all
 * unknown.
 *
 * So this parser judges almost nothing. Timestamps keep their raw text and are
 * only interpreted when they match a shape we recognise; an empty `End` is taken
 * as "no end recorded" rather than an error, since an in-progress fast is the
 * obvious reason for one. An unrecognised timestamp produces no issue: we have no
 * grounds to call a format wrong when we never established what right looks like.
 * Only structural damage — a row of the wrong width — is reported.
 *
 * The file is also Gold-gated (DATA_MODEL.md §6). Its absence is not this
 * parser's concern; nothing here is ever called for a file that is not there.
 */
export function parseFasts(text: string, file = 'fasts.csv'): ParseResult<FastInterval> {
  return parseRowFile(text, file, FASTS_COLUMNS, (record, columns) => {
    const endText = cell(record, columns, 'End');

    return {
      name: cell(record, columns, 'Name'),
      start: parseLocalTimestamp(cell(record, columns, 'Start')),
      end: endText === '' ? undefined : parseLocalTimestamp(endText),
      recurrence: cell(record, columns, 'Recurrence'),
      comments: cell(record, columns, 'Comments'),
    };
  });
}
