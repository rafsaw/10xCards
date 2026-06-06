import "./tests/e2e/load-env";
import { defineConfig, devices } from "@playwright/test";

// Astro dev server default port.
const PORT = 4321;
const STORAGE_STATE = "tests/e2e/.auth/user.json";

export default defineConfig({
  testDir: "./tests/e2e",
  // Serial: the specs share one storageState account and one `astro dev` server.
  // One worker removes cross-test full-page reloads (Vite optimizeDeps) and any
  // shared due-queue races — determinism matters more than speed for 2 specs.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    // Mints an ephemeral test user, logs in, saves storageState. `teardown`
    // deletes that user after the suite finishes.
    { name: "setup", testMatch: /auth\.setup\.ts/, teardown: "cleanup" },
    { name: "cleanup", testMatch: /global\.teardown\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
      // Only real specs run here — not the setup/teardown helper files.
      testMatch: /\.spec\.ts$/,
    },
  ],
  // Boots the real app so internal boundaries (auth, routing, API, Supabase)
  // stay real. Astro loads .env itself for `astro:env/server`.
  webServer: {
    command: "npm run dev",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
