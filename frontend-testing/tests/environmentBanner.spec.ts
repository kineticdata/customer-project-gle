import { test, expect, Page } from "@playwright/test";
import {
  createUser,
  deleteUser,
  openPortal,
  readSpaceSettings,
  requireSpaceChanges,
  signIn,
  TestUser,
  updateSpaceSettings,
} from "../passwordHelpers";

const MARKING = "TEST ENVIRONMENT";

// Kinetic Platform 7.0: the space's Environment Banner is shown before and after sign in, in the
// page flow (it never covers the portal's header or footer).
test.describe("Environment Banner", () => {
  requireSpaceChanges();
  test.describe.configure({ mode: "serial" });

  let user: TestUser;
  let saved: Record<string, any>;
  test.beforeAll(async () => {
    saved = await readSpaceSettings(["environmentBanner"]);
    user = await createUser();
  });
  test.afterAll(async () => {
    await updateSpaceSettings({ environmentBanner: saved.environmentBanner });
    await deleteUser(user.username);
  });

  const bars = (page: Page) =>
    page.getByRole("note", { name: `Environment: ${MARKING}` });

  test("visible at the top before and after sign in, without covering the header", async ({
    page,
  }) => {
    await updateSpaceSettings({
      environmentBanner: { enabled: true, text: MARKING, position: "top" },
    });
    await openPortal(page);
    await expect(bars(page)).toHaveCount(1);
    await expect(bars(page).first()).toBeVisible();

    await signIn(page, user.username, user.password);
    await expect(page.getByRole("button", { name: "Sign In" })).toHaveCount(0);
    await expect(bars(page)).toHaveCount(1);

    // In the page flow: the header starts below the bar
    const bar = await bars(page).first().boundingBox();
    const header = await page.locator("#app-header").boundingBox();
    expect(bar && header && bar.y + bar.height <= header.y + 0.5).toBeTruthy();
  });

  test("also at the bottom for top and bottom", async ({ page }) => {
    await updateSpaceSettings({
      environmentBanner: { enabled: true, text: MARKING, position: "topAndBottom" },
    });
    await openPortal(page);
    await expect(bars(page)).toHaveCount(2);

    // The bottom bar comes after the footer area
    const bottom = await bars(page).last().boundingBox();
    const footer = await page.locator("#app-footer").boundingBox();
    expect(bottom && footer && bottom.y >= footer.y + footer.height - 0.5).toBeTruthy();
  });

  test("not shown when the space turns it off", async ({ page }) => {
    await updateSpaceSettings({ environmentBanner: { enabled: false } });
    await openPortal(page);
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(bars(page)).toHaveCount(0);
  });
});
