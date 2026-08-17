import type {
  BiometricEntry,
  DailySummaryDay,
  ExerciseEntry,
  FastInterval,
  NoteEntry,
  ServingEntry,
} from '../domain/entries.js';
import { parseBiometrics } from './biometrics.js';
import { parseDailySummary } from './dailysummary.js';
import { parseExercises } from './exercises.js';
import { parseFasts } from './fasts.js';
import { EXPORT_FILE_NAMES, type ExportFileName, type ParseIssue, type ParseResult } from './issues.js';
import { parseNotes } from './notes.js';
import { parseServings } from './servings.js';

export interface ParsedExport {
  readonly servings: ParseResult<ServingEntry>;
  readonly dailySummary: ParseResult<DailySummaryDay>;
  readonly biometrics: ParseResult<BiometricEntry>;
  readonly exercises: ParseResult<ExerciseEntry>;
  readonly notes: ParseResult<NoteEntry>;
  readonly fasts: ParseResult<FastInterval>;
  /** Which of the six files the caller supplied at all. */
  readonly filesProvided: readonly ExportFileName[];
  /** Which were absent. Absence is a fact about the export, not a failure. */
  readonly filesAbsent: readonly ExportFileName[];
  /** Present but with no data rows — a third state, distinct from the other two. */
  readonly filesEmpty: readonly ExportFileName[];
  /** Every issue from every file, in file order. */
  readonly issues: readonly ParseIssue[];
}

const EMPTY: ParseResult<never> = { rows: [], issues: [] };

/**
 * Parses whatever an export happens to contain.
 *
 * Still pure: it takes file contents, not paths, so nothing here reads a disk.
 * Reading files is the caller's job, which keeps `parse/` free of I/O and makes
 * a partial export easy to construct in a test.
 *
 * A missing file is not an error. `fasts.csv` is Gold-gated, and DATA_MODEL.md §6
 * records that assuming it exists is what made an earlier implementation
 * effectively Gold-required. Which files are present, and which have rows, is
 * reported as data for a later milestone to interpret; no tier is inferred here.
 */
export function parseExportSet(
  files: Readonly<Partial<Record<ExportFileName, string>>>,
): ParsedExport {
  const read = <T>(
    name: ExportFileName,
    parse: (text: string, file: string) => ParseResult<T>,
  ): ParseResult<T> => {
    const text = files[name];
    if (text === undefined) return EMPTY;
    return parse(text, name);
  };

  const servings = read('servings.csv', parseServings);
  const dailySummary = read('dailysummary.csv', parseDailySummary);
  const biometrics = read('biometrics.csv', parseBiometrics);
  const exercises = read('exercises.csv', parseExercises);
  const notes = read('notes.csv', parseNotes);
  const fasts = read('fasts.csv', parseFasts);

  const byName: Readonly<Record<ExportFileName, ParseResult<unknown>>> = {
    'servings.csv': servings,
    'dailysummary.csv': dailySummary,
    'biometrics.csv': biometrics,
    'exercises.csv': exercises,
    'notes.csv': notes,
    'fasts.csv': fasts,
  };

  const filesProvided = EXPORT_FILE_NAMES.filter((name) => files[name] !== undefined);
  const filesAbsent = EXPORT_FILE_NAMES.filter((name) => files[name] === undefined);
  const filesEmpty = filesProvided.filter((name) => byName[name].rows.length === 0);

  return {
    servings,
    dailySummary,
    biometrics,
    exercises,
    notes,
    fasts,
    filesProvided,
    filesAbsent,
    filesEmpty,
    issues: filesProvided.flatMap((name) => byName[name].issues),
  };
}
