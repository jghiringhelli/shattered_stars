import { defineConfig } from "vitest/config";

/**
 * Skill-arena project: piloting gates and harness sanity tests.
 * Kept out of the default `npm test` include (files are *.skill.ts) so the
 * gates measure without blocking commits. Run with `npm run test:skill`.
 * SKILL_PAIRS / SKILL_SEEDS / SKILL_SQUAD_SEEDS env vars widen the sample.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/skill/**/*.skill.ts"],
    setupFiles: ["tests/skill/steeringSetup.ts"],
    testTimeout: 600000,
    hookTimeout: 600000,
  },
});
