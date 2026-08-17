import { describe, expect, it } from 'vitest';

import { parseBiometrics } from '../../src/parse/biometrics.js';
import { readFixture } from '../support/fixtures.js';

describe('gold-complete', () => {
  const parsed = parseBiometrics(readFixture('gold-complete', 'biometrics.csv'));

  it('reads every row with no issues', () => {
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows).toHaveLength(6);
  });

  it('parses a row whose Time is empty', () => {
    // BUILD_PLAN.md M1 acceptance 5. Every weight in the sample export had one,
    // so this is the normal case, not an edge one.
    const weight = parsed.rows[0];
    expect(weight).toEqual({
      day: '2026-08-14',
      time: undefined,
      group: 'Uncategorized',
      metric: 'Weight',
      amount: { value: 180.0, unit: 'lbs' },
    });
  });

  it('carries the unit through as data rather than converting it', () => {
    expect(parsed.rows.map((r) => r.amount.unit)).toEqual([
      'lbs',
      'lbs',
      'lbs',
      'mmHg',
      'mmHg',
      '%',
    ]);
  });

  it('does not hardcode the metric vocabulary', () => {
    expect(parsed.rows.map((r) => r.metric)).toContain('Blood Pressure (Systolic)');
    expect(parsed.rows.map((r) => r.metric)).toContain('Body Fat');
  });

  it('reads a bare Amount, not the fused one servings.csv uses', () => {
    // Same column name in both files, different shape. 180.0 has no unit in it.
    expect(parsed.rows[0]?.amount.value).toBe(180);
  });
});

describe('malformed', () => {
  const parsed = parseBiometrics(readFixture('malformed', 'biometrics.csv'));

  it('keeps the readable rows and reports the rest', () => {
    expect(parsed.rows.map((r) => r.amount.value)).toEqual([178.8, 179.1, 81.6]);
    expect(parsed.issues.every((i) => i.file === 'biometrics.csv')).toBe(true);
  });

  it('accepts an empty Unit rather than throwing the measurement away', () => {
    expect(parsed.rows[1]).toMatchObject({ metric: 'Weight', amount: { value: 179.1, unit: '' } });
  });

  it('accepts a kg row alongside the lbs ones', () => {
    // A metric account exports kg. Nothing here decides which is correct.
    expect(parsed.rows.map((r) => r.amount.unit)).toContain('kg');
  });

  it('drops a measurement with no metric, and says so', () => {
    const empty = parsed.issues.filter((i) => i.code === 'empty-required-field');
    expect(empty.map((i) => i.column)).toEqual(['Metric']);
    expect(empty[0]?.line).toBe(4);
  });

  it('drops a non-numeric Amount, and says so', () => {
    const bad = parsed.issues.find((i) => i.code === 'invalid-number');
    expect(bad?.column).toBe('Amount');
    expect(bad?.line).toBe(5);
  });

  it('drops rows of the wrong width, both too short and too long', () => {
    const widths = parsed.issues.filter((i) => i.code === 'field-count');
    expect(widths.map((i) => i.line)).toEqual([7, 8]);
  });
});
