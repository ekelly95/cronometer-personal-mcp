import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',

    // Vitest's default is 5 seconds, which quietly assumes the machine is idle.
    // Several tests here spawn a Node subprocess — the stdio server, the live bridge,
    // the Claude Desktop helper — and on a loaded CI runner that is nowhere near
    // enough.
    //
    // The measurement that settled it: one run on a degraded Windows runner failed six
    // tests, and among them was a *pure synchronous function call* that took 11.6
    // seconds. Nothing in this codebase can make that slow, so the ceiling was wrong
    // rather than the code.
    //
    // This weakens no assertion. Every test that actually cares about timing sets its
    // own deadline — the live bridge takes its timeout as a constructor argument — so
    // a genuinely hung test still fails, just less prematurely.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
