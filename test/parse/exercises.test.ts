import { describe, expect, it } from 'vitest';

import { MISSING, present } from '../../src/domain/nutrient.js';
import { parseExercises } from '../../src/parse/exercises.js';
import { readFixture } from '../support/fixtures.js';

describe('gold-complete', () => {
  const parsed = parseExercises(readFixture('gold-complete', 'exercises.csv'));

  it('reads every row with no issues', () => {
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows).toHaveLength(3);
  });

  it('reads minutes and calories as measured numbers', () => {
    expect(parsed.rows[0]).toEqual({
      day: '2026-08-14',
      time: { hour: 6, minute: 30, raw: '6:30 AM' },
      group: 'Uncategorized',
      exercise: 'Walking (moderate pace)',
      minutes: present(45, 0),
      caloriesBurned: present(168, 0),
    });
  });
});

describe('malformed', () => {
  const parsed = parseExercises(readFixture('malformed', 'exercises.csv'));

  it('keeps a row whose duration it cannot read, marking the duration Missing', () => {
    // Dropping the row would lose a workout that was genuinely logged; defaulting
    // the minutes to zero would invent one that lasted no time at all.
    const running = parsed.rows.find((r) => r.exercise === 'Running');
    expect(running?.minutes).toEqual(MISSING);
    expect(running?.caloriesBurned).toEqual(present(400, 0));
  });

  it('says which column it could not read', () => {
    const bad = parsed.issues.find((i) => i.code === 'invalid-number');
    expect(bad).toMatchObject({ file: 'exercises.csv', line: 3, column: 'Minutes' });
  });

  it('drops the ragged row and keeps the one after it', () => {
    expect(parsed.issues.filter((i) => i.code === 'field-count')).toHaveLength(1);
    expect(parsed.rows.map((r) => r.exercise)).toContain('Rowing, Machine');
  });

  it('accepts an empty Time', () => {
    expect(parsed.rows.find((r) => r.exercise === 'Rowing, Machine')?.time).toBeUndefined();
  });
});
