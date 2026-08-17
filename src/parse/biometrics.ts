import type { BiometricEntry } from '../domain/entries.js';
import { readMeasuredCell } from '../domain/nutrient.js';
import { cell } from './columns.js';
import { issue, type ParseResult } from './issues.js';
import { parseRowFile, readPointEvent } from './rows.js';

export const BIOMETRICS_COLUMNS = ['Day', 'Time', 'Group', 'Metric', 'Unit', 'Amount'];

/**
 * `biometrics.csv` — entity-attribute-value, and the only file with an explicit
 * `Unit` column.
 *
 * Its `Amount` is a bare number with the unit in its own column, where
 * `servings.csv` fuses the two into one string. Same column name, different
 * shape, so this file must not reuse the fused-amount rule.
 *
 * `Metric` and `Unit` are carried through as data. DATA_MODEL.md §3 is explicit
 * that the metric vocabulary is open-ended and that units reflect the account's
 * display preference — a metric account exports `kg` where this one exports
 * `lbs`. Neither is validated against a list, and nothing is converted.
 *
 * An empty `Unit` is accepted rather than rejected: there is no way to know that
 * a unitless metric is wrong, and refusing the row would lose the measurement.
 */
export function parseBiometrics(
  text: string,
  file = 'biometrics.csv',
): ParseResult<BiometricEntry> {
  return parseRowFile(text, file, BIOMETRICS_COLUMNS, (record, columns, issues) => {
    const spine = readPointEvent(record, columns, file);
    issues.push(...spine.issues);
    if (spine.event === undefined) return undefined;

    const metric = cell(record, columns, 'Metric');
    if (metric === '') {
      issues.push(
        issue(file, record.line, 'empty-required-field', 'measurement has no metric', 'Metric'),
      );
      return undefined;
    }

    const amount = readMeasuredCell(cell(record, columns, 'Amount'));
    if (amount.kind === 'missing') {
      issues.push(
        issue(file, record.line, 'empty-required-field', 'measurement has no amount', 'Amount'),
      );
      return undefined;
    }
    if (amount.kind === 'unreadable') {
      issues.push(
        issue(file, record.line, 'invalid-number', 'not a plain decimal number', 'Amount'),
      );
      return undefined;
    }

    return {
      ...spine.event,
      metric,
      amount: { value: amount.value.value, unit: cell(record, columns, 'Unit') },
    };
  });
}
