import { describe, expect, it } from 'vitest';

import {
  MISSING,
  isMissing,
  isPresent,
  present,
  readMeasuredCell,
  type NutrientValue,
} from '../../src/domain/nutrient.js';

describe('an empty cell and a measured zero are different values', () => {
  const empty = readMeasuredCell('');
  const zero = readMeasuredCell('0.00');

  it('an empty nutrient cell reads as Missing', () => {
    expect(empty).toEqual({ kind: 'missing' });
  });

  it('"0.00" reads as Present(0)', () => {
    expect(zero).toEqual({ kind: 'present', value: { kind: 'present', value: 0, decimals: 2 } });
  });

  it('the two are not equal', () => {
    expect(empty).not.toEqual(zero);
    expect(MISSING).not.toEqual(present(0, 2));
  });

  it('a measured zero still narrows to the number zero', () => {
    if (zero.kind !== 'present') throw new Error('expected a value');
    expect(isPresent(zero.value)).toBe(true);
    expect(zero.value.value).toBe(0);
  });
});

describe('the type system will not let the two be conflated', () => {
  // These assertions are enforced by `npm run typecheck`, which compiles this
  // directory: a @ts-expect-error on a line that compiles cleanly is itself an
  // error, so each one fails loudly if the union ever gets widened.
  const value: NutrientValue = readMeasuredCell('0.00').kind === 'present' ? present(0, 2) : MISSING;

  it('cannot read a number off the union without narrowing it', () => {
    // @ts-expect-error — `value` may be Missing, which has no `.value`.
    const leaked: number = value.value;
    expect(leaked).toBeDefined();
  });

  it('the `?? 0` reflex does not compile', () => {
    // The union is never nullish, so defaulting cannot rescue it: the result is
    // still not a number, and the habit that silently invents data is dead here.
    // @ts-expect-error — `value ?? 0` is a NutrientValue-or-zero, not a number.
    const invented: number = value ?? 0;
    expect(invented).toBeDefined();
  });

  it('cannot stand in for a number anywhere', () => {
    // @ts-expect-error — a NutrientValue is not a number.
    const summed: number = value;
    expect(summed).toBeDefined();
  });

  it('narrowing is the only way through, and it works', () => {
    const readable: number = isPresent(value) ? value.value : Number.NaN;
    expect(Number.isNaN(readable)).toBe(false);
  });

  it('Missing carries no number at all', () => {
    expect(isMissing(MISSING)).toBe(true);
    // @ts-expect-error — Missing has no numeric payload to reach for.
    expect(MISSING.value).toBeUndefined();
  });
});

describe('reading a cell has three outcomes, not two', () => {
  it.each([
    ['', 'missing'],
    ['0.00', 'present'],
    ['0', 'present'],
    ['181.00', 'present'],
    // Every quantity read through here is physically non-negative, so a negative
    // cell is one we cannot believe. Accepting it would let it subtract from a
    // subtotal while coverage still called the day complete.
    ['-1.50', 'unreadable'],
    ['-0', 'unreadable'],
    ['N/A', 'unreadable'],
    [' ', 'unreadable'],
    ['1,234.00', 'unreadable'],
    ['1e3', 'unreadable'],
    ['0x10', 'unreadable'],
    ['Infinity', 'unreadable'],
    ['NaN', 'unreadable'],
  ])('%o reads as %s', (raw, kind) => {
    expect(readMeasuredCell(raw).kind).toBe(kind);
  });

  it('keeps the decimal precision the cell was written with', () => {
    const decimalsOf = (raw: string): number => {
      const read = readMeasuredCell(raw);
      if (read.kind !== 'present') throw new Error(`expected a value for ${raw}`);
      return read.value.decimals;
    };
    // M2 needs this to size the benign rounding tolerance for a column.
    expect(decimalsOf('0.76')).toBe(2);
    expect(decimalsOf('180.0')).toBe(1);
    expect(decimalsOf('124')).toBe(0);
  });
});
