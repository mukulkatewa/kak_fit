/**
 * Smoke tests — proof the app boots and the signed-out shell renders.
 *
 * These deliberately require no API and no database, so they stay green as a
 * pure "did the bundle break" signal. Flow tests that need real data belong in
 * their own spec files and should sign in with a seeded dev session token
 * (see `pnpm db:seed:dev`).
 */
import { expect, test } from "@playwright/test";

test.describe("app shell", () => {
  test("boots and renders the sign-in screen", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/");

    // Unauthenticated users land on the login screen.
    await expect(page.getByText("Kak Fit").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();

    // A red-screen bundle failure would surface here.
    const fatal = consoleErrors.filter(
      (text) =>
        text.includes("Unable to resolve") ||
        text.includes("Invariant Violation") ||
        text.includes("Element type is invalid"),
    );
    expect(fatal, `Fatal console errors:\n${fatal.join("\n")}`).toHaveLength(0);
  });

  test("does not scroll horizontally on a phone viewport", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Kak Fit").first()).toBeVisible();

    // Horizontal overflow was a recurring layout bug during the July design pass.
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows, "Page scrolls horizontally on a phone viewport").toBe(false);
  });
});
