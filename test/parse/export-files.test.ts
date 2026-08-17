import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  ExportAccessError,
  MAX_EXPORT_FILE_BYTES,
  listExportFolders,
  readExportFolder,
} from '../../src/parse/export-files.js';

/**
 * This is the only code in the server that opens a file, and the files it opens
 * are a person's whole diary. The tests below are mostly about what it refuses.
 */

const workspace = mkdtempSync(join(tmpdir(), 'cronometer-exports-'));
const root = join(workspace, 'exports');
const outside = join(workspace, 'somewhere-else');
mkdirSync(root, { recursive: true });
mkdirSync(outside, { recursive: true });
writeFileSync(join(outside, 'dailysummary.csv'), 'Date,Group,Completed\n');

function makeExport(name: string, files: Record<string, string>): string {
  const folder = join(root, name);
  mkdirSync(folder, { recursive: true });
  for (const [file, contents] of Object.entries(files)) {
    writeFileSync(join(folder, file), contents);
  }
  return folder;
}

makeExport('2026-08-16', {
  'dailysummary.csv': 'Date,Group,Completed\n2026-08-16,"Breakfast",false\n',
  'servings.csv': 'Day,Time,Group,Food Name,Amount,Category\n',
  'biometrics.csv': 'Day,Time,Group,Metric,Unit,Amount\n',
});
makeExport('empty-folder', {});
makeExport('not-an-export', { 'readme.txt': 'nothing to see' });

afterAll(() => {
  // Left in the OS temp directory; removing it is the OS's job and deleting
  // recursively in a test is a worse risk than the stray folder.
});

describe('the export reader refuses anything outside its root', () => {
  it.each([
    ['a parent traversal', '..'],
    ['a nested traversal', '../somewhere-else'],
    ['a Windows separator', '..\\somewhere-else'],
    ['a POSIX separator', 'a/b'],
    ['an absolute Windows path', 'C:\\Windows'],
    ['an absolute POSIX path', '/etc'],
    ['a leading dot', '.hidden'],
    ['an empty name', ''],
  ])('refuses %s', (_label, name) => {
    expect(() => readExportFolder(root, name)).toThrow(ExportAccessError);
  });

  it('refuses a name that resolves outside the root through a symlink', () => {
    // The name itself is blameless — no separators, no dots. Only resolving it
    // reveals the escape, which is why containment is checked after realpath and
    // not by inspecting the string.
    let linked = true;
    try {
      symlinkSync(outside, join(root, 'sneaky'), 'junction');
    } catch {
      linked = false; // Unprivileged Windows sessions may refuse to create links.
    }
    if (!linked) return;

    expect(() => readExportFolder(root, 'sneaky')).toThrow(/resolves outside/i);
  });

  it('refuses a folder that exists but holds none of the six files', () => {
    expect(() => readExportFolder(root, 'not-an-export')).toThrow(/none of the six/i);
  });

  it('refuses a file larger than the cap rather than reading it', () => {
    const name = 'oversized';
    makeExport(name, {});
    // Sparse-ish: written once, then reported by size, so the test stays fast.
    writeFileSync(join(root, name, 'dailysummary.csv'), Buffer.alloc(MAX_EXPORT_FILE_BYTES + 1));
    expect(() => readExportFolder(root, name)).toThrow(/larger than the 25 MB limit/i);
  });

  it('says so plainly when the export directory itself does not exist', () => {
    expect(() => listExportFolders(join(workspace, 'no-such-root'))).toThrow(
      /export directory does not exist/i,
    );
  });
});

describe('the export reader reports what is there', () => {
  it('reads the files an export has and reports the rest as absent', () => {
    const files = readExportFolder(root, '2026-08-16');
    expect(Object.keys(files).sort()).toEqual([
      'biometrics.csv',
      'dailysummary.csv',
      'servings.csv',
    ]);
    expect(files['dailysummary.csv']).toContain('Group');
  });

  it('lists folders with their file inventory without reading contents', () => {
    const folders = listExportFolders(root);
    const found = folders.find((folder) => folder.name === '2026-08-16');

    expect(found).toBeDefined();
    expect([...(found?.filesPresent ?? [])].sort()).toEqual([
      'biometrics.csv',
      'dailysummary.csv',
      'servings.csv',
    ]);
    // A Gold-gated or simply unused file is absent, not an error.
    expect(found?.filesAbsent).toContain('fasts.csv');
    expect(found?.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('omits folders holding none of the six files, so the list means something', () => {
    const names = listExportFolders(root).map((folder) => folder.name);
    expect(names).not.toContain('not-an-export');
    expect(names).not.toContain('empty-folder');
  });
});
