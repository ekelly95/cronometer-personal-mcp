/**
 * Dates and times exactly as the exports record them.
 *
 * DATA_MODEL.md §5 rule 7: no export carries a timezone. A `Day` plus a local
 * `Time` is all there is. Nothing here converts to a JS `Date` — doing so would
 * attach the host machine's timezone to data that never had one, and the
 * timezone is user-supplied configuration that arrives in M4.
 */

declare const CALENDAR_DAY: unique symbol;

/** An ISO calendar date, `2026-08-16`, already checked to be a real date. */
export type CalendarDay = string & { readonly [CALENDAR_DAY]: true };

/** A wall-clock time of day, with no date and no offset. */
export interface LocalTime {
  /** 0–23. Derived, so times can be ordered; the export writes 12-hour. */
  readonly hour: number;
  /** 0–59. */
  readonly minute: number;
  /** Exactly as recorded, e.g. `9:39 PM`. Kept so output can round-trip. */
  readonly raw: string;
}

/**
 * A `Start` or `End` from `fasts.csv`. DATA_MODEL.md §8 question 3: the format is
 * entirely unverified, so the raw text is always preserved and `day`/`time` are
 * filled in only when the text matches a shape we recognise. Rejecting an
 * unrecognised format would throw away real data over a guess.
 */
export interface LocalTimestamp {
  readonly raw: string;
  readonly day: CalendarDay | undefined;
  readonly time: LocalTime | undefined;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK_12H = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/;
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2})(?:[T ](((\d{1,2}):(\d{2}))(?::\d{2})?))?$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/**
 * Returns `undefined` rather than a domain-specific failure value because there
 * is no tempting default to fall into — nobody accidentally substitutes a date.
 * Nutrient cells get an explicit union instead, because zero is right there.
 */
export function parseCalendarDay(raw: string): CalendarDay | undefined {
  const match = ISO_DATE.exec(raw);
  if (match === null) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return undefined;
  if (day < 1 || day > daysInMonth(year, month)) return undefined;
  return raw as CalendarDay;
}

export function parseLocalTime(raw: string): LocalTime | undefined {
  const match = CLOCK_12H.exec(raw);
  if (match === null) return undefined;
  const hour12 = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = (match[3] ?? '').toUpperCase();
  if (hour12 < 1 || hour12 > 12 || minute > 59) return undefined;
  const hour = meridiem === 'AM' ? hour12 % 12 : (hour12 % 12) + 12;
  return { hour, minute, raw };
}

/** Minutes since local midnight. Only meaningful within one calendar day. */
export function minutesFromMidnight(time: LocalTime): number {
  return time.hour * 60 + time.minute;
}

/**
 * DATA_MODEL.md §5 rule 4: rows are not time-sorted, so anything that wants
 * chronological order has to ask for it. Comparing `raw` would not work — on a
 * 12-hour clock `9:30 PM` sorts before `3:30 PM` as text.
 */
export function compareLocalTime(a: LocalTime, b: LocalTime): number {
  return minutesFromMidnight(a) - minutesFromMidnight(b);
}

export function parseLocalTimestamp(raw: string): LocalTimestamp {
  const match = TIMESTAMP.exec(raw);
  if (match === null) return { raw, day: undefined, time: undefined };

  const day = parseCalendarDay(match[1] ?? '');
  if (day === undefined) return { raw, day: undefined, time: undefined };

  const timeText = match[2];
  const hourText = match[4];
  const minuteText = match[5];
  if (timeText === undefined || hourText === undefined || minuteText === undefined) {
    return { raw, day, time: undefined };
  }

  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (hour > 23 || minute > 59) return { raw, day, time: undefined };

  // A 24-hour clock here, unlike the diary files' 12-hour one; `raw` keeps the
  // source text either way.
  return { raw, day, time: { hour, minute, raw: timeText } };
}
