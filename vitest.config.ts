import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Bound jsdom/React concurrency on shared runners: unrestricted workers
    // can starve interactive navigation tests of their five-second budget.
    maxWorkers: 2,
    globals: true,
    include: ['**/*.test.{ts,tsx}'],
    // Tests must not depend on, or be perturbed by, a developer's local .env
    // (an added Gemini key would otherwise flip AI features on mid-suite and
    // break the offline-path assertions). Force the key empty for the runner;
    // tests that exercise the AI path stub it themselves.
    env: { VITE_GEMINI_API_KEY: '' },
  },
});
