import { parseCalendarDay, parseLocalTime } from '../domain/calendar.js';
import type { PointEvent } from '../domain/events.js';
import { cell, mapColumns, type ColumnMap } from './columns.js';
import { readCsv, type CsvRecord } from './csv.js';
import { issue, type ParseIssue, type ParseResult } from './issues.js';

/**
 * A row whose field count does not match the header cannot be read by position
 * or by name — the cells no longer line up with anything. Reported and dropped.
 */
export function checkFieldCount(
  record: CsvRecord,
  columns: ColumnMap,
  file: string,
): ParseIssue | undefined {
  if (record.fields.length === columns.width) return undefined;
  return issue(
    file,
    record.line,
    'field-count',
    `row has ${record.fields.length} fields, header has ${columns.width}`,
  );
}

/**
 * Everything five of the six parsers do identically: find the header, refuse the
 * file if a required column is absent, drop rows whose width does not match, and
 * report an unclosed quote.
 *
 * A malformed row never stops the import (BUILD_PLAN.md M1 §7) — it produces an
 * issue naming the file and line, and the rows after it are still read.
 */
export function parseRowFile<T>(
  text: string,
  file: string,
  required: readonly string[],
  readRow: (record: CsvRecord, columns: ColumnMap, issues: ParseIssue[]) => T | undefined,
): ParseResult<T> {
  const doc = readCsv(text);
  const header = doc.header;
  const issues: ParseIssue[] = [];
  const rows: T[] = [];

  if (header === undefined) {
    return { rows, issues: [issue(file, 1, 'missing-column', 'file has no header row')] };
  }

  const columns = mapColumns(header, required);
  if (columns.missing.length > 0) {
    // Without the columns, positions mean nothing; reading on would invent data.
    return {
      rows,
      issues: columns.missing.map((name) =>
        issue(file, header.line, 'missing-column', 'column not found in header', name),
      ),
    };
  }

  for (const record of doc.records) {
    const widthIssue = checkFieldCount(record, columns, file);
    if (widthIssue !== undefined) {
      issues.push(widthIssue);
      continue;
    }
    const row = readRow(record, columns, issues);
    if (row !== undefined) rows.push(row);
  }

  if (doc.unterminatedQuoteAtLine !== undefined) {
    issues.push(
      issue(file, doc.unterminatedQuoteAtLine, 'unterminated-quote', 'quoted field never closed'),
    );
  }

  return { rows, issues };
}

/**
 * The `Day, Time, Group` prefix shared by servings, biometrics, exercises and
 * notes (DATA_MODEL.md §2).
 *
 * An empty `Time` yields `undefined` and no issue — that is normal, and every
 * biometric weight in the sample export had one. An unparseable `Time` is
 * different: something was recorded and we cannot read it, so the row is dropped
 * rather than presented as though no time had been logged.
 */
export function readPointEvent(
  record: CsvRecord,
  columns: ColumnMap,
  file: string,
): { readonly event: PointEvent | undefined; readonly issues: readonly ParseIssue[] } {
  const issues: ParseIssue[] = [];

  const day = parseCalendarDay(cell(record, columns, 'Day'));
  if (day === undefined) {
    issues.push(issue(file, record.line, 'invalid-date', 'not an ISO calendar date', 'Day'));
  }

  const timeText = cell(record, columns, 'Time');
  let time: ReturnType<typeof parseLocalTime>;
  if (timeText !== '') {
    time = parseLocalTime(timeText);
    if (time === undefined) {
      issues.push(
        issue(file, record.line, 'invalid-time', 'not a 12-hour clock time', 'Time'),
      );
    }
  }

  if (day === undefined || (timeText !== '' && time === undefined)) {
    return { event: undefined, issues };
  }

  return {
    event: { day, time, group: cell(record, columns, 'Group') },
    issues,
  };
}
