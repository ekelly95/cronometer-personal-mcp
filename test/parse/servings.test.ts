import { describe, expect, it } from 'vitest';

import { parseServings } from '../../src/parse/servings.js';
import { readFixture } from '../support/fixtures.js';

describe('gold-complete', () => {
  const parsed = parseServings(readFixture('gold-complete', 'servings.csv'));

  it('reads every row with no issues', () => {
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows).toHaveLength(21);
  });

  it('unfuses an Amount whose unit contains digits, hyphens and spaces', () => {
    const lasagna = parsed.rows.find((r) => r.foodName.startsWith('Lasagna'));
    expect(lasagna?.amount).toEqual({ value: 1.0, unit: 'container - each 5.3 oz' });
  });

  it('never infers time of day from the group', () => {
    // BUILD_PLAN.md M1 acceptance 6, and DATA_MODEL.md section 5 rule 6: a group
    // is a user's label. Both values have to survive intact and independently.
    const lateYogurt = parsed.rows.find(
      (r) => r.day === '2026-08-14' && r.time?.raw === '9:39 PM',
    );
    expect(lateYogurt?.group).toBe('Breakfast');
    expect(lateYogurt?.time).toEqual({ hour: 21, minute: 39, raw: '9:39 PM' });
    expect(lateYogurt?.foodName).toBe('Greek Yogurt, Plain, Nonfat');
  });

  it('keeps the file order, which is not time order', () => {
    const snacks = parsed.rows.filter((r) => r.day === '2026-08-14' && r.group === 'Snacks');
    expect(snacks.map((r) => r.time?.raw)).toEqual(['9:30 PM', '3:30 PM']);
  });

  it('keeps commas inside a food name and inside a category', () => {
    const bagels = parsed.rows.find((r) => r.foodName.startsWith('Bagels'));
    expect(bagels?.foodName).toBe('Bagels, plain, enriched, with calcium propionate');

    const lasagna = parsed.rows.find((r) => r.foodName.startsWith('Lasagna'));
    expect(lasagna?.category).toBe('Meals, Entrees, and Sidedishes');
  });

  it('treats Group as an open vocabulary', () => {
    expect(new Set(parsed.rows.map((r) => r.group))).toEqual(
      new Set(['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Uncategorized']),
    );
  });
});

describe('malformed', () => {
  const parsed = parseServings(readFixture('malformed', 'servings.csv'));

  it('does not abort the import — the valid row after the broken ones survives', () => {
    expect(parsed.rows.map((r) => r.foodName)).toContain('Valid Row After The Broken Ones');
    expect(parsed.rows.length).toBeGreaterThan(5);
  });

  it('names the file and line of every defect', () => {
    expect(parsed.issues.length).toBeGreaterThan(0);
    for (const issue of parsed.issues) {
      expect(issue.file).toBe('servings.csv');
      expect(issue.line).toBeGreaterThan(1);
      expect(Number.isInteger(issue.line)).toBe(true);
    }
  });

  it('reports each kind of defect the fixture contains', () => {
    const codes = new Set(parsed.issues.map((i) => i.code));
    expect(codes).toContain('field-count');
    expect(codes).toContain('invalid-date');
    expect(codes).toContain('invalid-time');
    expect(codes).toContain('invalid-amount');
    expect(codes).toContain('unterminated-quote');
  });

  it('points at the right lines', () => {
    const lineOf = (code: string): number | undefined =>
      parsed.issues.find((i) => i.code === code)?.line;

    expect(lineOf('field-count')).toBe(9); // the five-field row
    expect(lineOf('invalid-date')).toBe(11); // 2026-13-45
    expect(lineOf('invalid-time')).toBe(14); // 25:99 XM
    expect(lineOf('unterminated-quote')).toBe(22);
  });

  it('never quotes the offending cell back, because that text is untrusted', () => {
    for (const issue of parsed.issues) {
      expect(issue.detail).not.toMatch(/cmd|calc|Ben & Jerry|Salad/);
      expect(issue.column === undefined || typeof issue.column === 'string').toBe(true);
    }
  });

  it('accepts a custom diary group instead of rejecting it', () => {
    expect(parsed.rows.map((r) => r.group)).toContain('Second Breakfast');
  });

  it('keeps injection payloads verbatim, as data', () => {
    const names = parsed.rows.map((r) => r.foodName);
    expect(names).toContain("=cmd|'/c calc'!A1");
    expect(names).toContain('Ben & Jerry\'s "Half Baked", pint');
    expect(names.some((n) => n.includes('\n'))).toBe(true);
    expect(names.some((n) => /\p{Extended_Pictographic}/u.test(n))).toBe(true);
  });

  it('drops rows it cannot read rather than guessing at them', () => {
    const names = parsed.rows.map((r) => r.foodName);
    expect(names).not.toContain('Impossible Date Food');
    expect(names).not.toContain('Impossible Time Food');
    expect(names).not.toContain('Amount With No Unit');
    expect(names).not.toContain('Amount With No Number');
  });
});

describe('a header that does not match', () => {
  it('refuses the file and says which column is absent', () => {
    const parsed = parseServings('Day,Time,Group,Food Name,Category\n2026-08-16,,Breakfast,x,y\n');
    expect(parsed.rows).toEqual([]);
    expect(parsed.issues).toEqual([
      {
        file: 'servings.csv',
        line: 1,
        code: 'missing-column',
        column: 'Amount',
        detail: 'column not found in header',
      },
    ]);
  });

  it('reads a reordered header by name', () => {
    const parsed = parseServings(
      'Category,Amount,Food Name,Group,Time,Day\nSnacks,1.00 oz,Almonds,Snacks,9:30 PM,2026-08-14\n',
    );
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows[0]).toEqual({
      day: '2026-08-14',
      time: { hour: 21, minute: 30, raw: '9:30 PM' },
      group: 'Snacks',
      foodName: 'Almonds',
      amount: { value: 1, unit: 'oz' },
      category: 'Snacks',
    });
  });

  it('ignores an extra column it does not recognise', () => {
    const parsed = parseServings(
      'Day,Time,Group,Food Name,Amount,Category,Something New\n2026-08-14,9:30 PM,Snacks,Almonds,1.00 oz,Snacks,x\n',
    );
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
  });
});
