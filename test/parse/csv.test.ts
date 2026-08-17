import { describe, expect, it } from 'vitest';

import { escapeCsvField, formatCsv, formatCsvRow, readCsv } from '../../src/parse/csv.js';
import { parseServings } from '../../src/parse/servings.js';
import { readFixture } from '../support/fixtures.js';

describe('reading', () => {
  it('splits plain rows', () => {
    const doc = readCsv('a,b\n1,2\n3,4\n');
    expect(doc.header?.fields).toEqual(['a', 'b']);
    expect(doc.records.map((r) => r.fields)).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('numbers records by the physical line they start on', () => {
    const doc = readCsv('a,b\n1,2\n3,4\n');
    expect(doc.records.map((r) => r.line)).toEqual([2, 3]);
  });

  it('keeps commas and doubled quotes inside a quoted field', () => {
    const doc = readCsv('a\n"Ben & Jerry\'s ""Half Baked"", pint"\n');
    expect(doc.records[0]?.fields).toEqual(['Ben & Jerry\'s "Half Baked", pint']);
  });

  it('keeps a newline inside a quoted field, and keeps counting lines past it', () => {
    const doc = readCsv('a,b\n"two\nlines",x\nafter,y\n');
    expect(doc.records[0]?.fields).toEqual(['two\nlines', 'x']);
    expect(doc.records[1]?.line).toBe(4);
  });

  it('reports an unterminated quote and drops the debris after it', () => {
    const doc = readCsv('a,b\nok,1\n"never closed,2\n');
    expect(doc.records.map((r) => r.fields)).toEqual([['ok', '1']]);
    expect(doc.unterminatedQuoteAtLine).toBe(3);
  });

  it('tolerates a BOM and CRLF, which the exports do not have but editors add', () => {
    const doc = readCsv(`${String.fromCharCode(0xfeff)}a,b\r\n1,2\r\n`);
    expect(doc.header?.fields).toEqual(['a', 'b']);
    expect(doc.records[0]?.fields).toEqual(['1', '2']);
  });

  it('treats a header-only file as a header and no records', () => {
    const doc = readCsv('a,b,c\n');
    expect(doc.header?.fields).toEqual(['a', 'b', 'c']);
    expect(doc.records).toEqual([]);
  });

  it('preserves empty fields rather than collapsing them', () => {
    expect(readCsv('a,b,c\n,x,\n').records[0]?.fields).toEqual(['', 'x', '']);
  });
});

describe('writing escapes what a spreadsheet would execute', () => {
  it.each(['=cmd|\'/c calc\'!A1', '+1-800-555-0100', '-2+3+cmd', '@SUM(1+9)'])(
    'neutralises a field beginning with the formula character in %o',
    (value) => {
      const written = escapeCsvField(value);
      expect(written.startsWith('"\'')).toBe(true);

      const readBack = readCsv(`Food Name\n${written}\n`).records[0]?.fields[0];
      expect(readBack).toBe(`'${value}`);
      expect(readBack?.startsWith('=')).toBe(false);
    },
  );

  it('round-trips a real food name beginning with = straight out of the fixture', () => {
    const parsed = parseServings(readFixture('malformed', 'servings.csv'));
    const dangerous = parsed.rows.find((row) => row.foodName.startsWith('='));
    if (dangerous === undefined) throw new Error('fixture no longer has a formula-injection name');

    const written = formatCsv([
      ['Day', 'Time', 'Group', 'Food Name', 'Amount', 'Category'],
      [
        dangerous.day,
        dangerous.time?.raw ?? '',
        dangerous.group,
        dangerous.foodName,
        `${dangerous.amount.value.toFixed(2)} ${dangerous.amount.unit}`,
        dangerous.category,
      ],
    ]);

    const roundTripped = readCsv(written).records[0]?.fields[3];
    expect(roundTripped).toBe(`'${dangerous.foodName}`);
    expect(written).not.toContain(',=cmd');
  });

  it('quotes commas, quotes and newlines', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('two\nlines')).toBe('"two\nlines"');
  });

  it('strips control characters that would corrupt the file', () => {
    const withControls = `sane${String.fromCharCode(0x00)}${String.fromCharCode(0x07)}text`;
    expect(escapeCsvField(withControls)).toBe('sanetext');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeCsvField('Greek Yogurt')).toBe('Greek Yogurt');
    expect(formatCsvRow(['a', 'b'])).toBe('a,b');
  });

  it('survives a round trip of everything awkward at once', () => {
    const nasty = ['=danger', 'a,b', 'say "hi"', 'two\nlines', '🥗 Salad'];
    const readBack = readCsv(formatCsv([nasty])).header?.fields;
    expect(readBack).toEqual(["'=danger", 'a,b', 'say "hi"', 'two\nlines', '🥗 Salad']);
  });
});
