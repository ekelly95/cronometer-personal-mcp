import { describe, expect, it } from 'vitest';

import { parseFusedAmount } from '../../src/domain/quantity.js';

describe('unfusing servings.csv Amount cells', () => {
  it('keeps a unit that contains digits, hyphens and spaces', () => {
    // The case in BUILD_PLAN.md M1, and the reason splitting on whitespace fails.
    expect(parseFusedAmount('1.00 container - each 5.3 oz')).toEqual({
      value: 1.0,
      unit: 'container - each 5.3 oz',
    });
  });

  it.each([
    ['2.00 bagel', 2, 'bagel'],
    ['32.00 fl oz', 32, 'fl oz'],
    ['0.50 pint', 0.5, 'pint'],
    ['1.50 cup', 1.5, 'cup'],
    ['10.00 oz', 10, 'oz'],
    ['2.00 tbsp', 2, 'tbsp'],
  ])('reads %o as %d %s', (raw, value, unit) => {
    expect(parseFusedAmount(raw)).toEqual({ value, unit });
  });

  it.each([
    ['1.00', 'a number with no unit'],
    ['two bagels', 'a unit with no number'],
    ['', 'nothing at all'],
    ['1.00container', 'no separator'],
    ['1.2.3 cup', 'a number the digit-and-dot class matches but Number does not'],
    ['... cup', 'dots alone'],
  ])('rejects %o — %s', (raw) => {
    expect(parseFusedAmount(raw)).toBeUndefined();
  });
});
