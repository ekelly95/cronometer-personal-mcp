import type { CalendarDay, LocalTime, LocalTimestamp } from './calendar.js';
import type { DiaryGroup } from './diary.js';

/**
 * The shared spine of `servings`, `biometrics`, `exercises` and `notes`, all of
 * which open with the same three columns (DATA_MODEL.md §2).
 */
export interface PointEvent {
  readonly day: CalendarDay;
  /**
   * Absent when the export left `Time` empty, which is normal — every biometric
   * weight in the sample export did. `undefined` means "not recorded", and is
   * never a stand-in for midnight.
   */
  readonly time: LocalTime | undefined;
  readonly group: DiaryGroup;
}

/**
 * A fast, which is the one thing in the dataset with a duration rather than an
 * instant. DATA_MODEL.md §2 is explicit that it must not be forced into the
 * point-event shape: `fasts.csv` has `Start`/`End` and no `Group` at all.
 */
export interface IntervalEvent {
  readonly start: LocalTimestamp;
  /** Absent while a fast is still running, or if the export simply left it blank. */
  readonly end: LocalTimestamp | undefined;
}
