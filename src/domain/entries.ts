import type { CalendarDay } from './calendar.js';
import type { Completed, DiaryGroup } from './diary.js';
import type { IntervalEvent, PointEvent } from './events.js';
import type { MeasuredNumber } from './nutrient.js';
import type { NutrientTable } from './nutrients.js';
import type { Quantity } from './quantity.js';

/** One logged food. `servings.csv` carries no nutrients and no gram weights. */
export interface ServingEntry extends PointEvent {
  /**
   * Free text authored by users and food databases. Untrusted: it reaches a
   * language model, and it reaches CSV output. Stored verbatim — escaping happens
   * at the boundary it is crossing, not here, so nothing is lost on the way in.
   */
  readonly foodName: string;
  /** Quantity and unit, unfused from the single `Amount` cell. */
  readonly amount: Quantity;
  /** Food taxonomy, e.g. `Baked Products`. Open vocabulary, never an enum. */
  readonly category: string;
}

/**
 * One measurement. DATA_MODEL.md §3 calls this the best-designed of the six
 * files: entity-attribute-value with an explicit `Unit` column. Note that its
 * `Amount` is a bare number with the unit alongside, where `servings.csv` fuses
 * the two into one string — same column name, different shape.
 */
export interface BiometricEntry extends PointEvent {
  /** Open vocabulary: weight, blood pressure, glucose, body fat, and so on. */
  readonly metric: string;
  readonly amount: Quantity;
}

export interface ExerciseEntry extends PointEvent {
  readonly exercise: string;
  /** `MeasuredNumber` for the same reason nutrients are: zero is not absence. */
  readonly minutes: MeasuredNumber;
  readonly caloriesBurned: MeasuredNumber;
}

export interface NoteEntry extends PointEvent {
  /**
   * Fully user-authored free text — DATA_MODEL.md §3 calls it the highest
   * prompt-injection risk in the dataset. Stored verbatim and treated as data;
   * whatever it says, it is a note, not an instruction.
   */
  readonly note: string;
}

export interface FastInterval extends IntervalEvent {
  readonly name: string;
  /** Grammar unverified (DATA_MODEL.md §8 question 3); carried through as text. */
  readonly recurrence: string;
  readonly comments: string;
}

/** One diary group's row in `dailysummary.csv`. */
export interface DailySummaryGroup {
  readonly group: DiaryGroup;
  readonly nutrients: NutrientTable;
}

/**
 * One day of `dailysummary.csv`, with Cronometer's own `Total` row held apart
 * from the group rows rather than mixed in with them.
 *
 * The separation is structural on purpose. DATA_MODEL.md §5 rule 1 requires
 * filtering `Total` before summing or every day double-counts, and a flat list of
 * rows makes that a thing you have to remember. Here `groups` cannot contain it.
 *
 * `reportedTotal` is kept rather than discarded because M2 needs to compare it
 * against a recomputed total and classify the divergence: rounding, which is
 * benign, or missing-as-zero, which is the finding. Discarding it would leave
 * nothing to compare against.
 */
export interface DailySummaryDay {
  readonly date: CalendarDay;
  readonly groups: readonly DailySummaryGroup[];
  /** Absent if the export had no `Total` row for this day. */
  readonly reportedTotal: NutrientTable | undefined;
  readonly completed: Completed;
}
