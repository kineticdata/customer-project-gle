import { test, expect } from "@playwright/test";
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

const BANNER_TEXT = "Authorized use only.\nActivity may be monitored.";

// Kinetic Platform 7.0: the space's login banner, which may have to be acknowledged before a
// username and password sign in.
test.describe("login banner", () => {
  requireSpaceChanges();
  // These change one space-wide setting, so they run one at a time.
  test.describe.configure({ mode: "serial" });

  let user: TestUser;
  let saved: Record<string, any>;
  test.beforeAll(async () => {
    saved = await readSpaceSettings(["loginBanner"]);
  });
  test.afterAll(async () => {
    await updateSpaceSettings({ loginBanner: saved.loginBanner });
  });
  test.beforeEach(async () => {
    user = await createUser();
    await updateSpaceSettings({
      loginBanner: {
        enabled: true,
        text: BANNER_TEXT,
        requireAcknowledgment: true,
      },
    });
  });
  test.afterEach(async () => {
    await deleteUser(user.username);
  });

  test("the credentials can be entered only after the banner is acknowledged", async ({
    page,
  }) => {
    await openPortal(page);
    const banner = page.getByRole("region", { name: "Login banner" });
    await expect(banner).toContainText("Authorized use only.");
    await expect(banner).toContainText("Activity may be monitored.");

    await expect(page.getByLabel("Username")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeDisabled();

    await page.getByLabel("I have read and agree to the notice above").check();
    await expect(page.getByLabel("Username")).toBeEnabled();
    await signIn(page, user.username, user.password);
    await expect(page.getByRole("button", { name: "Sign In" })).toHaveCount(0);
  });

  test("a banner that changed during sign in is shown again to acknowledge", async ({
    page,
  }) => {
    await openPortal(page);
    await page.getByLabel("I have read and agree to the notice above").check();

    // The admin changes the text after the page loaded
    await updateSpaceSettings({
      loginBanner: { text: "Updated notice. Please read again." },
    });
    await signIn(page, user.username, user.password);

    // Refused: the new text is shown, and the box must be checked again
    await expect(
      page.getByRole("region", { name: "Login banner" }),
    ).toContainText("Updated notice. Please read again.");
    await expect(
      page.getByLabel("I have read and agree to the notice above"),
    ).not.toBeChecked();

    await page.getByLabel("I have read and agree to the notice above").check();
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("button", { name: "Sign In" })).toHaveCount(0);
  });
});
