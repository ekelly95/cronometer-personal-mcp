import { describe, expect, it } from 'vitest';

import { MISSING, present } from '../../src/domain/nutrient.js';
import {
  NUTRIENTS,
  NUTRIENT_BY_CSV_HEADER,
  NUTRIENT_BY_ID,
  NUTRIENT_IDS,
  emptyNutrientTable,
  nutrientTable,
} from '../../src/domain/nutrients.js';
import { readCsv } from '../../src/parse/csv.js';
import { readFixture } from '../support/fixtures.js';

describe('the canonical nutrient vocabulary', () => {
  it('has 61 nutrients with unique ids', () => {
    expect(NUTRIENTS).toHaveLength(61);
    expect(new Set(NUTRIENT_IDS).size).toBe(61);
  });

  it('matches the real header row, column for column and in order', () => {
    // The strongest check available: the fixture header is separately verified
    // against DATA_MODEL.md by test/fixtures.test.ts, so agreeing with it ties
    // this table to the spec without restating the spec here.
    const header = readCsv(readFixture('gold-complete', 'dailysummary.csv')).header;
    if (header === undefined) throw new Error('fixture has no header');

    expect(header.fields.slice(2, -1)).toEqual(NUTRIENTS.map((n) => n.csvHeader));
    expect(header.fields[0]).toBe('Date');
    expect(header.fields[1]).toBe('Group');
    expect(header.fields.at(-1)).toBe('Completed');
  });

  it('uses the micro sign U+00B5, never Greek mu U+03BC', () => {
    const micro = String.fromCharCode(0x00b5);
    const greek = String.fromCharCode(0x03bc);
    const headers = NUTRIENTS.map((n) => n.csvHeader).join('\n');
    expect(headers).not.toContain(greek);
    expect(headers.split(micro)).toHaveLength(6); // five columns carry it
  });

  it('derives each unit from its header, including the two odd ones', () => {
    // DATA_MODEL.md section 3: Vitamin D is IU where the other fat-soluble
    // vitamins are micrograms, and Protein sits inside the amino-acid block.
    expect(NUTRIENT_BY_ID.vitaminD.unit).toBe('IU');
    expect(NUTRIENT_BY_ID.b12.unit).toBe(`${String.fromCharCode(0x00b5)}g`);
    expect(NUTRIENT_BY_ID.energy.unit).toBe('kcal');
    expect(NUTRIENT_BY_ID.protein.unit).toBe('g');
    expect(NUTRIENT_BY_ID.protein.section).toBe('aminoAcids');
    expect(NUTRIENT_BY_ID.sodium.unit).toBe('mg');
  });

  it('is indexable by header text', () => {
    expect(NUTRIENT_BY_CSV_HEADER.get('Omega-3 (g)')?.id).toBe('omega3');
    expect(NUTRIENT_BY_CSV_HEADER.get('B3 (Niacin) (mg)')?.id).toBe('b3');
    expect(NUTRIENT_BY_CSV_HEADER.get('Not A Nutrient')).toBeUndefined();
  });
});

describe('nutrient tables are always complete', () => {
  it('fills every nutrient the source did not mention with Missing, never zero', () => {
    const table = nutrientTable(new Map([['protein', present(181, 2)]]));
    expect(table.protein).toEqual(present(181, 2));
    expect(table.omega3).toEqual(MISSING);
    expect(Object.keys(table)).toHaveLength(61);
  });

  it('an empty table is 61 Missings', () => {
    const table = emptyNutrientTable();
    expect(Object.values(table).every((v) => v.kind === 'missing')).toBe(true);
  });

  it('a lookup is never undefined, so there is nothing to default', () => {
    const table = emptyNutrientTable();
    // Unlike a Map, whose .get() would hand back `NutrientValue | undefined`.
    expect(table.omega3.kind).toBe('missing');
  });
});
