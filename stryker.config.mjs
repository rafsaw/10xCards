// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: "npm",

  testRunner: "vitest",
  plugins: ["@stryker-mutator/vitest-runner"],

  //RS>> TODO: Refactor to full-project mutation testing. ("src/**/*.ts") Module 3 Lesson 2. "Stryker krok po kroku"
// Temporary focused mutation scope.
// Full-project mutation testing is deferred because Astro + Cloudflare
// currently crashes under Stryker with concurrency > 1 on this environment.
// Prioritise critical business logic first, then widen the scope gradually.
  mutate: [
    // "src/lib/account-retention.ts", 
    // "src/lib/leitner.ts",
 "src/lib/openrouter.ts"
  ],

  reporters: ["progress", "clear-text", "html"],

  coverageAnalysis: "perTest",
  
  // RS>> Keep at 1: Astro Cloudflare adapter crashes in parallel Stryker workers on Windows/Node 24.
  concurrency: 1,

  thresholds: {
    high: 80,
    low: 60,
    break: null,
  },
};

export default config;