/**
 * E2E tests against the Expo app running on react-native-web.
 *
 * The same screens that run on iOS and Android render as real DOM in a browser,
 * so Playwright can drive actual user flows — sign-in, booking, prescribing a
 * plan — with no simulator and no build. This is the tier that makes UI
 * regressions cheap to catch.
 *
 * Not covered here: anything genuinely native (push notifications, the Android
 * workout widget, background services). Those still need a dev client on a
 * device. Everything in the coaching layer is plain React Native and works.
 *
 *   pnpm test:e2e            # headless
 *   pnpm test:e2e:ui         # Playwright UI mode, great for writing tests
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 8081);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Expo's web dev server is slow to boot and hot-reloads mid-run.
  timeout: 60_000,
  expect: { timeout: 15_000 },

  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "mobile-web",
      // Phone-sized viewport — this is a mobile-first app and desktop layout
      // is not what users see.
      use: { ...devices["Pixel 7"], isMobile: false, hasTouch: true },
    },
  ],

  // Reuse an already-running `pnpm dev:web-app` locally; boot one in CI.
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: "pnpm exec expo start --web --port " + PORT,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
