import type { NutrientValue } from './nutrient.js';
import { MISSING } from './nutrient.js';
import type { Unit } from './quantity.js';

/**
 * The 61 nutrient columns of `dailysummary.csv`, in file order, transcribed from
 * DATA_MODEL.md §3.
 *
 * This lives in `domain/` rather than `parse/` because `analyze/` needs to name
 * nutrients and, by the dependency rule in CLAUDE.md, cannot import `parse/`.
 *
 * Two details from the spec that look like transcription errors and are not:
 * Vitamin D is in IU while every other fat-soluble vitamin is µg, and Protein
 * sits inside the amino-acid block rather than with the macros. Both are how the
 * export orders and labels them.
 *
 * The micro sign in these headers is U+00B5, not Greek mu U+03BC. The two are
 * visually identical; `test/domain/nutrients.test.ts` checks the codepoint, and
 * checks every header against the fixture's real header row.
 */
const RAW_NUTRIENTS = [
  { id: 'energy', csvHeader: 'Energy (kcal)', section: 'general' },
  { id: 'alcohol', csvHeader: 'Alcohol (g)', section: 'general' },
  { id: 'caffeine', csvHeader: 'Caffeine (mg)', section: 'general' },
  { id: 'oxalate', csvHeader: 'Oxalate (mg)', section: 'general' },
  { id: 'phytate', csvHeader: 'Phytate (mg)', section: 'general' },
  { id: 'water', csvHeader: 'Water (g)', section: 'general' },

  { id: 'b1', csvHeader: 'B1 (Thiamine) (mg)', section: 'vitamins' },
  { id: 'b2', csvHeader: 'B2 (Riboflavin) (mg)', section: 'vitamins' },
  { id: 'b3', csvHeader: 'B3 (Niacin) (mg)', section: 'vitamins' },
  { id: 'b5', csvHeader: 'B5 (Pantothenic Acid) (mg)', section: 'vitamins' },
  { id: 'b6', csvHeader: 'B6 (Pyridoxine) (mg)', section: 'vitamins' },
  { id: 'b12', csvHeader: 'B12 (Cobalamin) (µg)', section: 'vitamins' },
  { id: 'folate', csvHeader: 'Folate (µg)', section: 'vitamins' },
  { id: 'vitaminA', csvHeader: 'Vitamin A (µg)', section: 'vitamins' },
  { id: 'vitaminC', csvHeader: 'Vitamin C (mg)', section: 'vitamins' },
  { id: 'vitaminD', csvHeader: 'Vitamin D (IU)', section: 'vitamins' },
  { id: 'vitaminE', csvHeader: 'Vitamin E (mg)', section: 'vitamins' },
  { id: 'vitaminK', csvHeader: 'Vitamin K (µg)', section: 'vitamins' },

  { id: 'calcium', csvHeader: 'Calcium (mg)', section: 'minerals' },
  { id: 'copper', csvHeader: 'Copper (mg)', section: 'minerals' },
  { id: 'iron', csvHeader: 'Iron (mg)', section: 'minerals' },
  { id: 'magnesium', csvHeader: 'Magnesium (mg)', section: 'minerals' },
  { id: 'manganese', csvHeader: 'Manganese (mg)', section: 'minerals' },
  { id: 'phosphorus', csvHeader: 'Phosphorus (mg)', section: 'minerals' },
  { id: 'potassium', csvHeader: 'Potassium (mg)', section: 'minerals' },
  { id: 'selenium', csvHeader: 'Selenium (µg)', section: 'minerals' },
  { id: 'sodium', csvHeader: 'Sodium (mg)', section: 'minerals' },
  { id: 'zinc', csvHeader: 'Zinc (mg)', section: 'minerals' },

  { id: 'netCarbs', csvHeader: 'Net Carbs (g)', section: 'carbohydrates' },
  { id: 'carbs', csvHeader: 'Carbs (g)', section: 'carbohydrates' },
  { id: 'fiber', csvHeader: 'Fiber (g)', section: 'carbohydrates' },
  { id: 'insolubleFiber', csvHeader: 'Insoluble Fiber (g)', section: 'carbohydrates' },
  { id: 'solubleFiber', csvHeader: 'Soluble Fiber (g)', section: 'carbohydrates' },
  { id: 'starch', csvHeader: 'Starch (g)', section: 'carbohydrates' },
  { id: 'sugars', csvHeader: 'Sugars (g)', section: 'carbohydrates' },
  { id: 'addedSugars', csvHeader: 'Added Sugars (g)', section: 'carbohydrates' },

  { id: 'fat', csvHeader: 'Fat (g)', section: 'lipids' },
  { id: 'cholesterol', csvHeader: 'Cholesterol (mg)', section: 'lipids' },
  { id: 'monounsaturated', csvHeader: 'Monounsaturated (g)', section: 'lipids' },
  { id: 'polyunsaturated', csvHeader: 'Polyunsaturated (g)', section: 'lipids' },
  { id: 'saturated', csvHeader: 'Saturated (g)', section: 'lipids' },
  { id: 'transFats', csvHeader: 'Trans-Fats (g)', section: 'lipids' },
  { id: 'omega3', csvHeader: 'Omega-3 (g)', section: 'lipids' },
  { id: 'ala', csvHeader: 'ALA (g)', section: 'lipids' },
  { id: 'dha', csvHeader: 'DHA (g)', section: 'lipids' },
  { id: 'epa', csvHeader: 'EPA (g)', section: 'lipids' },
  { id: 'omega6', csvHeader: 'Omega-6 (g)', section: 'lipids' },
  { id: 'aa', csvHeader: 'AA (g)', section: 'lipids' },
  { id: 'la', csvHeader: 'LA (g)', section: 'lipids' },

  { id: 'cystine', csvHeader: 'Cystine (g)', section: 'aminoAcids' },
  { id: 'histidine', csvHeader: 'Histidine (g)', section: 'aminoAcids' },
  { id: 'isoleucine', csvHeader: 'Isoleucine (g)', section: 'aminoAcids' },
  { id: 'leucine', csvHeader: 'Leucine (g)', section: 'aminoAcids' },
  { id: 'lysine', csvHeader: 'Lysine (g)', section: 'aminoAcids' },
  { id: 'methionine', csvHeader: 'Methionine (g)', section: 'aminoAcids' },
  { id: 'phenylalanine', csvHeader: 'Phenylalanine (g)', section: 'aminoAcids' },
  { id: 'protein', csvHeader: 'Protein (g)', section: 'aminoAcids' },
  { id: 'threonine', csvHeader: 'Threonine (g)', section: 'aminoAcids' },
  { id: 'tryptophan', csvHeader: 'Tryptophan (g)', section: 'aminoAcids' },
  { id: 'tyrosine', csvHeader: 'Tyrosine (g)', section: 'aminoAcids' },
  { id: 'valine', csvHeader: 'Valine (g)', section: 'aminoAcids' },
] as const;

export type NutrientId = (typeof RAW_NUTRIENTS)[number]['id'];
export type NutrientSection = (typeof RAW_NUTRIENTS)[number]['section'];

export interface NutrientDefinition {
  readonly id: NutrientId;
  /** Exact header text in `dailysummary.csv`, including the unit. */
  readonly csvHeader: string;
  readonly section: NutrientSection;
  /** Derived from the header rather than restated, so the two cannot drift apart. */
  readonly unit: Unit;
}

const TRAILING_PARENTHETICAL = /\(([^()]*)\)\s*$/;

function unitFromHeader(csvHeader: string): Unit {
  const match = TRAILING_PARENTHETICAL.exec(csvHeader);
  if (match === null || match[1] === undefined) {
    throw new Error(`nutrient header carries no unit: ${csvHeader}`);
  }
  return match[1];
}

export const NUTRIENTS: readonly NutrientDefinition[] = RAW_NUTRIENTS.map((n) => ({
  id: n.id,
  csvHeader: n.csvHeader,
  section: n.section,
  unit: unitFromHeader(n.csvHeader),
}));

export const NUTRIENT_IDS: readonly NutrientId[] = NUTRIENTS.map((n) => n.id);

export const NUTRIENT_BY_ID: Readonly<Record<NutrientId, NutrientDefinition>> = Object.freeze(
  Object.fromEntries(NUTRIENTS.map((n) => [n.id, n])) as Record<NutrientId, NutrientDefinition>,
);

export const NUTRIENT_BY_CSV_HEADER: ReadonlyMap<string, NutrientDefinition> = new Map(
  NUTRIENTS.map((n) => [n.csvHeader, n]),
);

/**
 * Every nutrient, always. A `Record` over a closed union rather than a `Map`
 * because `Map.get` returns `T | undefined`, which puts the nullable number back
 * exactly where the whole design is trying to remove it. Here a lookup is always
 * a `NutrientValue`, and the only way to read a number out is to narrow the union.
 */
export type NutrientTable = Readonly<Record<NutrientId, NutrientValue>>;

/**
 * Builds a complete table from whatever was found. A nutrient absent from the
 * source means its column was absent from the file, which is `Missing` — no data
 * for it — and never zero.
 */
export function nutrientTable(found: ReadonlyMap<NutrientId, NutrientValue>): NutrientTable {
  const table = {} as Record<NutrientId, NutrientValue>;
  for (const id of NUTRIENT_IDS) {
    const value = found.get(id);
    table[id] = value === undefined ? MISSING : value;
  }
  return table;
}

/** A table in which nothing was recorded. */
export function emptyNutrientTable(): NutrientTable {
  return nutrientTable(new Map());
}
