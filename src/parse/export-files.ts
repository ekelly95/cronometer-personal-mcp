import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

import { EXPORT_FILE_NAMES, type ExportFileName } from './issues.js';

/**
 * The only place in this server that reads a file.
 *
 * Everything else here talks to one HTTPS host through a bounded bridge. This is a
 * different kind of surface, and it holds real health data — a manual Cronometer
 * export is the whole diary, per meal — so the containment is the design rather
 * than a lining.
 *
 * Three rules, in the order they matter:
 *
 * 1. The model never supplies a path. It supplies a *name*, matched against a
 *    conservative pattern, which is then joined to a root it cannot influence.
 * 2. Containment is checked after resolution, not before. `realpath` collapses
 *    `..` and follows symlinks, so comparing the resolved child against the
 *    resolved root catches traversal and symlink escapes with one check. Pattern-
 *    matching for `../` and hoping is how these are usually got wrong.
 * 3. Only the six known filenames are ever opened, each size-capped. A folder that
 *    happens to contain something else is not a way to read it.
 */

/**
 * No separators, no leading dot, no `..`. Deliberately narrower than the
 * filesystem allows: a date-stamped folder is what this is for, and every
 * character permitted here is one fewer thing to reason about.
 */
const EXPORT_FOLDER_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/**
 * Matches the live response cap, so one number governs both paths. A real export
 * of several years is a few megabytes; anything approaching this is not an export.
 */
export const MAX_EXPORT_FILE_BYTES = 25 * 1024 * 1024;

export class ExportAccessError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ExportAccessError';
  }
}

export interface ExportFolderSummary {
  readonly name: string;
  readonly filesPresent: readonly ExportFileName[];
  readonly filesAbsent: readonly ExportFileName[];
  /** Most recent modification time across the export's files, ISO-8601. */
  readonly lastModified: string | undefined;
}

function resolvedRoot(root: string): string {
  try {
    return realpathSync(resolve(root));
  } catch {
    throw new ExportAccessError(
      'The export directory does not exist yet. Create it and put an extracted Cronometer export inside, one folder per export.',
    );
  }
}

/**
 * Refuses anything whose resolved location is not inside the resolved root.
 *
 * The trailing separator matters: without it, a sibling directory whose name
 * merely starts with the root's would pass.
 */
function containedPath(root: string, name: string): string {
  if (!EXPORT_FOLDER_NAME.test(name)) {
    throw new ExportAccessError(
      `'${name}' is not a usable export folder name. Use only letters, digits, dots, dashes and underscores — no path separators.`,
    );
  }

  const base = resolvedRoot(root);
  let candidate: string;
  try {
    candidate = realpathSync(join(base, name));
  } catch {
    throw new ExportAccessError(`No export folder named '${name}' was found.`);
  }

  if (candidate !== base && !candidate.startsWith(base + sep)) {
    // Reachable through a symlink pointing outside the root; the name itself
    // cannot express traversal, but what it points at still can.
    throw new ExportAccessError(
      `'${name}' resolves outside the export directory, so it was not read.`,
    );
  }
  return candidate;
}

export function listExportFolders(root: string): readonly ExportFolderSummary[] {
  const base = resolvedRoot(root);
  const summaries: ExportFolderSummary[] = [];

  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory() || !EXPORT_FOLDER_NAME.test(entry.name)) continue;

    const present: ExportFileName[] = [];
    const absent: ExportFileName[] = [];
    let newest: number | undefined;

    for (const file of EXPORT_FILE_NAMES) {
      try {
        // Directory metadata only. Listing what you have should not require
        // reading any of it.
        const stats = statSync(join(base, entry.name, file));
        if (!stats.isFile()) {
          absent.push(file);
          continue;
        }
        present.push(file);
        if (newest === undefined || stats.mtimeMs > newest) newest = stats.mtimeMs;
      } catch {
        absent.push(file);
      }
    }

    if (present.length > 0) {
      summaries.push({
        name: entry.name,
        filesPresent: present,
        filesAbsent: absent,
        lastModified: newest === undefined ? undefined : new Date(newest).toISOString(),
      });
    }
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Reads one export folder into the shape `parseExportSet` expects.
 *
 * A missing file is returned as absent rather than as an error: `fasts.csv` is
 * Gold-gated and `exercises.csv` is routinely empty, so refusing the whole export
 * over one absent file would reject ordinary exports.
 */
export function readExportFolder(
  root: string,
  name: string,
): Partial<Record<ExportFileName, string>> {
  const folder = containedPath(root, name);
  const files: Partial<Record<ExportFileName, string>> = {};

  for (const file of EXPORT_FILE_NAMES) {
    const path = join(folder, file);
    let stats;
    try {
      stats = statSync(path);
    } catch {
      continue;
    }
    if (!stats.isFile()) continue;
    if (stats.size > MAX_EXPORT_FILE_BYTES) {
      throw new ExportAccessError(
        `${file} in '${name}' is larger than the 25 MB limit, so it was not read. That is far beyond any real export.`,
      );
    }
    files[file] = readFileSync(path, 'utf8');
  }

  if (Object.keys(files).length === 0) {
    throw new ExportAccessError(
      `'${name}' contains none of the six Cronometer export files. Extract the export's CSVs directly into the folder.`,
    );
  }
  return files;
}
