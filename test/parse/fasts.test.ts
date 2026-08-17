import { describe, expect, it } from 'vitest';

import { parseFasts } from '../../src/parse/fasts.js';
import { readFixture } from '../support/fixtures.js';

describe('gold-complete', () => {
  const parsed = parseFasts(readFixture('gold-complete', 'fasts.csv'));

  it('reads every row with no issues', () => {
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows).toHaveLength(3);
  });

  it('reads an interval, not a point event — there is no Group here at all', () => {
    expect(parsed.rows[0]).toEqual({
      name: 'Overnight fast',
      start: {
        raw: '2026-08-14 20:15:00',
        day: '2026-08-14',
        time: { hour: 20, minute: 15, raw: '20:15:00' },
      },
      end: {
        raw: '2026-08-15 11:30:00',
        day: '2026-08-15',
        time: { hour: 11, minute: 30, raw: '11:30:00' },
      },
      recurrence: 'Daily',
      comments: 'Felt fine',
    });
  });

  it('reads a fast still in progress as having no end, not an end of nothing', () => {
    const inProgress = parsed.rows[2];
    expect(inProgress?.name).toBe('Current fast');
    expect(inProgress?.end).toBeUndefined();
    expect(inProgress?.start.day).toBe('2026-08-16');
  });
});

describe('malformed', () => {
  const parsed = parseFasts(readFixture('malformed', 'fasts.csv'));

  it('reports only structural damage, since the format itself is unverified', () => {
    // DATA_MODEL.md section 8 question 3: beyond the header, nothing about this
    // file is established. Calling an unfamiliar timestamp wrong would be a guess
    // dressed up as a finding.
    expect(parsed.issues.map((i) => i.code)).toEqual(['field-count']);
  });

  it('keeps an unrecognised timestamp as raw text rather than discarding the row', () => {
    const unparseable = parsed.rows.find((r) => r.name === 'Bad start fast');
    expect(unparseable?.start).toEqual({
      raw: 'not a timestamp',
      day: undefined,
      time: undefined,
    });
    expect(unparseable?.end?.day).toBe('2026-08-17');
  });

  it('does not reorder or reject a fast whose end precedes its start', () => {
    // Whether that is an error is a question for a later milestone; the parser's
    // job is to report what the file said.
    const backwards = parsed.rows.find((r) => r.name === 'Backwards fast');
    expect(backwards?.start.raw).toBe('2026-08-16 20:00:00');
    expect(backwards?.end?.raw).toBe('2026-08-16 08:00:00');
  });

  it('drops the ragged row', () => {
    expect(parsed.rows.map((r) => r.name)).not.toContain('Ragged fast');
    expect(parsed.issues[0]?.line).toBe(6);
  });
});
