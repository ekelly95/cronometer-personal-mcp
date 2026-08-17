import { describe, expect, it } from 'vitest';

import { parseBiometrics } from '../../src/parse/biometrics.js';
import { parseDailySummary } from '../../src/parse/dailysummary.js';
import { parseExercises } from '../../src/parse/exercises.js';
import { parseFasts } from '../../src/parse/fasts.js';
import { parseNotes } from '../../src/parse/notes.js';
import { parseServings } from '../../src/parse/servings.js';
import { readFixture } from '../support/fixtures.js';

// DATA_MODEL.md section 5 rule 9: three of the six files arrived from the real
// export with zero rows. Empty is a valid state, not a failure.
const PARSERS = [
  ['servings.csv', parseServings],
  ['dailysummary.csv', parseDailySummary],
  ['biometrics.csv', parseBiometrics],
  ['exercises.csv', parseExercises],
  ['notes.csv', parseNotes],
  ['fasts.csv', parseFasts],
] as const;

describe('a header-only file parses to an empty array, not an error', () => {
  it.each(PARSERS)('%s', (file, parse) => {
    const parsed = parse(readFixture('empty-diary', file));
    expect(parsed.rows).toEqual([]);
    expect(parsed.issues).toEqual([]);
  });

  it('does not throw for any of them', () => {
    for (const [file, parse] of PARSERS) {
      expect(() => parse(readFixture('empty-diary', file))).not.toThrow();
    }
  });
});

describe('a file with no header at all is a different thing', () => {
  it.each(PARSERS)('%s reports it rather than pretending to be empty', (_file, parse) => {
    const parsed = parse('');
    expect(parsed.rows).toEqual([]);
    expect(parsed.issues.map((i) => i.code)).toContain('missing-column');
  });
});
