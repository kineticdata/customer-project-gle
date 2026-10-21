import { test, expect } from "@playwright/test";
import {
  createUser,
  deleteUser,
  openPortal,
  requireSpaceChanges,
  signIn,
  strongPassword,
  TestUser,
} from "../passwordHelpers";

// Kinetic Platform 7.0: a user whose password an admin set must choose a new one at sign in.
test.describe("forced password change", () => {
  requireSpaceChanges();

  let user: TestUser;
  test.beforeEach(async () => {
    user = await createUser({ mustChangePassword: true });
  });
  test.afterEach(async () => {
    await deleteUser(user.username);
  });

  test("changing the password lands the user signed in", async ({ page }) => {
    await openPortal(page);
    await signIn(page, user.username, user.password);

    // The sign in is held: the change step replaces the login form
    await expect(
      page.getByRole("heading", { name: "Change your password" }),
    ).toBeVisible();
    await expect(page.getByLabel("Username")).toHaveCount(0);
    // The requirements checklist, with the rule only the server checks
    await expect(
      page.getByText("Different from your current password"),
    ).toBeVisible();

    const newPassword = strongPassword();
    await page.getByLabel("New Password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm New Password").fill(newPassword);
    await page.getByRole("button", { name: "Update Password" }).click();

    // Signed in: the portal is shown, not the login or change step
    await expect(
      page.getByRole("button", { name: "Update Password" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign In" })).toHaveCount(0);
    await expect(page.locator("#app-header")).not.toBeEmpty();
  });

  test("the confirmation must match", async ({ page }) => {
    await openPortal(page);
    await signIn(page, user.username, user.password);
    await page.getByLabel("New Password", { exact: true }).fill(strongPassword());
    await page.getByLabel("Confirm New Password").fill(strongPassword());
    await page.getByRole("button", { name: "Update Password" }).click();
    await expect(
      page.getByText("The new password and its confirmation don't match."),
    ).toBeVisible();
  });

  test("Sign Out ends the held sign in", async ({ page }) => {
    await openPortal(page);
    await signIn(page, user.username, user.password);
    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(page.getByLabel("Username")).toBeVisible();
  });

  test("the old password no longer works after the change", async ({
    page,
    browser,
  }) => {
    await openPortal(page);
    await signIn(page, user.username, user.password);
    const newPassword = strongPassword();
    await page.getByLabel("New Password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm New Password").fill(newPassword);
    await page.getByRole("button", { name: "Update Password" }).click();
    await expect(page.getByRole("button", { name: "Sign In" })).toHaveCount(0);

    // A new browser session with the admin-set password is refused
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await openPortal(otherPage);
    await signIn(otherPage, user.username, user.password);
    await expect(otherPage.locator(".kstatus-error").first()).toBeVisible();
    await expect(
      otherPage.getByRole("heading", { name: "Change your password" }),
    ).toHaveCount(0);
    await other.close();
  });
});
