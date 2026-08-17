import { describe, expect, it } from 'vitest';

import { parseExportSet } from '../../src/parse/export-set.js';
import { readFixtureSet } from '../support/fixtures.js';

describe('free-tier — the whole export, without fasts.csv', () => {
  const files = readFixtureSet('free-tier');
  const parsed = parseExportSet(files);

  it('has no fasts.csv to read', () => {
    expect(Object.keys(files)).not.toContain('fasts.csv');
    expect(parsed.filesAbsent).toEqual(['fasts.csv']);
    expect(parsed.filesProvided).toEqual([
      'servings.csv',
      'dailysummary.csv',
      'biometrics.csv',
      'exercises.csv',
      'notes.csv',
    ]);
  });

  it('parses everything else without complaint', () => {
    // BUILD_PLAN.md M1 acceptance 4. A Gold-gated file that is not there is a
    // fact about the account, not a failure of the import.
    expect(parsed.issues).toEqual([]);
    expect(parsed.servings.rows).toHaveLength(21);
    expect(parsed.dailySummary.rows).toHaveLength(3);
    expect(parsed.biometrics.rows).toHaveLength(6);
    expect(parsed.exercises.rows).toHaveLength(3);
    expect(parsed.notes.rows).toHaveLength(3);
  });

  it('reads no fasts, and does not confuse that with reading zero fasts', () => {
    expect(parsed.fasts.rows).toEqual([]);
    expect(parsed.fasts.issues).toEqual([]);
    expect(parsed.filesEmpty).not.toContain('fasts.csv');
  });

  it('is otherwise identical to the gold export', () => {
    const gold = parseExportSet(readFixtureSet('gold-complete'));
    expect(parsed.servings.rows).toEqual(gold.servings.rows);
    expect(parsed.dailySummary.rows).toEqual(gold.dailySummary.rows);
  });
});

describe('gold-complete', () => {
  const parsed = parseExportSet(readFixtureSet('gold-complete'));

  it('reads all six files with no issues', () => {
    expect(parsed.filesProvided).toHaveLength(6);
    expect(parsed.filesAbsent).toEqual([]);
    expect(parsed.filesEmpty).toEqual([]);
    expect(parsed.issues).toEqual([]);
    expect(parsed.fasts.rows).toHaveLength(3);
  });
});

describe('empty-diary — present but with nothing in it', () => {
  const parsed = parseExportSet(readFixtureSet('empty-diary'));

  it('separates present-and-empty from absent', () => {
    // Three distinct states across the fixtures: populated (gold-complete),
    // present but empty (here), and absent (free-tier). DATA_MODEL.md section 6
    // says capability follows from which files are present *and non-empty*.
    expect(parsed.filesAbsent).toEqual([]);
    expect(parsed.filesEmpty).toHaveLength(6);
    expect(parsed.issues).toEqual([]);
  });
});

describe('an export with only one file', () => {
  it('reads it and reports the other five as absent', () => {
    const parsed = parseExportSet({
      'notes.csv': 'Day,Time,Group,Note\n2026-08-16,9:00 PM,Dinner,Ate late.\n',
    });
    expect(parsed.notes.rows).toHaveLength(1);
    expect(parsed.filesAbsent).toHaveLength(5);
    expect(parsed.issues).toEqual([]);
  });

  it('reads nothing at all without failing', () => {
    const parsed = parseExportSet({});
    expect(parsed.filesProvided).toEqual([]);
    expect(parsed.issues).toEqual([]);
    expect(parsed.servings.rows).toEqual([]);
  });
});

describe('malformed', () => {
  const parsed = parseExportSet(readFixtureSet('malformed'));

  it('gathers every file\'s issues without any one file stopping the others', () => {
    const files = new Set(parsed.issues.map((i) => i.file));
    expect(files).toEqual(
      new Set([
        'servings.csv',
        'dailysummary.csv',
        'biometrics.csv',
        'exercises.csv',
        'notes.csv',
        'fasts.csv',
      ]),
    );
    expect(parsed.servings.rows.length).toBeGreaterThan(0);
    expect(parsed.notes.rows.length).toBeGreaterThan(0);
  });

  it('never leaks a filesystem path or a cell value into an issue', () => {
    for (const issue of parsed.issues) {
      expect(issue.file).not.toContain('/');
      expect(issue.file).not.toContain('\\');
      expect(issue.detail).not.toMatch(/cmd|calc|SYSTEM|ignore all/i);
    }
  });
});
