// Runs the PowerShell setup tests where PowerShell exists, and skips them where it
// does not.
//
// Those tests cover the Windows setup script — the Claude Desktop config rewriter in
// particular — so on a machine without `pwsh` there is nothing for them to test.
// Skipping is honest; failing would make `npm run verify` unusable on macOS for a
// reason that has nothing to do with the code being verified. The skip is loud, so it
// cannot be mistaken for a pass.
import { spawnSync } from 'node:child_process';

const probe = spawnSync('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], {
  stdio: 'ignore',
});

if (probe.error !== undefined || probe.status !== 0) {
  console.log('SKIPPED: scripts/test-setup-windows.ps1 needs PowerShell 7 (pwsh), which is absent.');
  console.log('         Those tests cover the Windows setup script only; nothing else is affected.');
  process.exit(0);
}

const result = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/test-setup-windows.ps1'], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
