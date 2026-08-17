import type { CsvRecord } from './csv.js';

/**
 * Column lookup by header name rather than by position.
 *
 * DATA_MODEL.md §8 questions 1 and 2 record that two of the two verifiable
 * schemas already diverge from what an older third-party parser expected, which
 * makes schema drift the likely explanation. Reading by name survives a reordered
 * or extended header; reading by position silently returns the wrong column.
 * Unrecognised extra columns are ignored rather than treated as errors.
 */
export interface ColumnMap {
  readonly index: ReadonlyMap<string, number>;
  readonly missing: readonly string[];
  readonly width: number;
}

export function mapColumns(header: CsvRecord, required: readonly string[]): ColumnMap {
  const index = new Map<string, number>();
  header.fields.forEach((name, position) => {
    // First occurrence wins; a duplicated header name is pathological and there
    // is no way to know which one was meant.
    if (!index.has(name)) index.set(name, position);
  });

  return {
    index,
    missing: required.filter((name) => !index.has(name)),
    width: header.fields.length,
  };
}

/**
 * Reads a cell. Returns `''` for a column that is not in this file at all, which
 * is the same thing the file says when the cell is empty — callers distinguish
 * the two by having already checked `missing`.
 */
export function cell(record: CsvRecord, columns: ColumnMap, name: string): string {
  const position = columns.index.get(name);
  if (position === undefined) return '';
  return record.fields[position] ?? '';
}
