import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

export const FIXTURE_ROOT = join(HERE, '..', 'fixtures');

export const FIXTURE_NAMES = [
  'gold-complete',
  'free-tier',
  'empty-diary',
  'missing-nutrients',
  'malformed',
] as const;

export type FixtureName = (typeof FIXTURE_NAMES)[number];

export function fixtureDir(name: FixtureName): string {
  return join(FIXTURE_ROOT, name);
}

export function fixtureFiles(name: FixtureName): string[] {
  return readdirSync(fixtureDir(name)).sort();
}

export function readFixture(name: FixtureName, file: string): string {
  return readFileSync(join(fixtureDir(name), file), 'utf8');
}

export function readFixtureBytes(name: FixtureName, file: string): Buffer {
  return readFileSync(join(fixtureDir(name), file));
}

/** Every file present in a fixture, as a name -> contents map. */
export function readFixtureSet(name: FixtureName): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of fixtureFiles(name)) {
    if (file.endsWith('.csv')) out[file] = readFixture(name, file);
  }
  return out;
}
