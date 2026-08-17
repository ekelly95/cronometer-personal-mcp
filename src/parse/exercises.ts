import type { ExerciseEntry } from '../domain/entries.js';
import { MISSING, readMeasuredCell, type MeasuredNumber } from '../domain/nutrient.js';
import { cell, type ColumnMap } from './columns.js';
import type { CsvRecord } from './csv.js';
import { issue, type ParseIssue, type ParseResult } from './issues.js';
import { parseRowFile, readPointEvent } from './rows.js';

export const EXERCISES_COLUMNS = ['Day', 'Time', 'Group', 'Exercise', 'Minutes', 'Calories Burned'];

/**
 * A numeric column that may legitimately be blank. Text we cannot read is
 * recorded as `Missing` and reported, rather than dropping the whole row: the
 * rest of the entry is still true, and `Missing` keeps any later arithmetic
 * honest about not knowing.
 */
function readOptionalNumber(
  record: CsvRecord,
  columns: ColumnMap,
  file: string,
  column: string,
  issues: ParseIssue[],
): MeasuredNumber {
  const read = readMeasuredCell(cell(record, columns, column));
  if (read.kind === 'present') return read.value;
  if (read.kind === 'unreadable') {
    issues.push(
      issue(file, record.line, 'invalid-number', 'not a plain decimal number', column),
    );
  }
  return MISSING;
}

/** `exercises.csv` — header-only in the sample export, which is a normal state. */
export function parseExercises(text: string, file = 'exercises.csv'): ParseResult<ExerciseEntry> {
  return parseRowFile(text, file, EXERCISES_COLUMNS, (record, columns, issues) => {
    const spine = readPointEvent(record, columns, file);
    issues.push(...spine.issues);
    if (spine.event === undefined) return undefined;

    return {
      ...spine.event,
      exercise: cell(record, columns, 'Exercise'),
      minutes: readOptionalNumber(record, columns, file, 'Minutes', issues),
      caloriesBurned: readOptionalNumber(record, columns, file, 'Calories Burned', issues),
    };
  });
}
