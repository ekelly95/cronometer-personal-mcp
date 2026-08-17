// Runs the Python bridge tests against the private virtual environment, wherever
// that environment keeps its interpreter.
//
// This used to be a shell string hard-coding `.venv-live\Scripts\python.exe`,
// which made `npm run verify` a Windows-only command for no good reason — the
// tests themselves are portable, and `src/live/client.ts` already looks in both
// places when it spawns the bridge for real. This does the same.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const candidates = [
  resolve('.venv-live', 'Scripts', 'python.exe'), // Windows
  resolve('.venv-live', 'bin', 'python3'), // macOS and Linux
  resolve('.venv-live', 'bin', 'python'),
];

const interpreter = candidates.find((path) => existsSync(path));
if (interpreter === undefined) {
  console.error(
    'No Python environment found at .venv-live. Run the setup script for your platform first.',
  );
  process.exit(1);
}

const result = spawnSync(
  interpreter,
  ['-m', 'unittest', 'discover', '-s', 'python', '-p', 'test_*.py', '-v'],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
