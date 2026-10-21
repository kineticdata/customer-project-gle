import { test, expect } from "@playwright/test";
import {
  adminSetPassword,
  createUser,
  deleteUser,
  openPortal,
  requireSpaceChanges,
  signIn,
  strongPassword,
  TestUser,
} from "../passwordHelpers";

// Kinetic Platform 7.0: the session-timeout dialog renders the same Login component, so a forced
// password change also works there.
test.describe("forced password change in the session-timeout dialog", () => {
  requireSpaceChanges();

  let user: TestUser;
  test.beforeEach(async () => {
    user = await createUser();
  });
  test.afterEach(async () => {
    await deleteUser(user.username);
  });

  test("the dialog shows the change step, and completing it continues the session", async ({
    page,
    context,
  }) => {
    await openPortal(page);
    await signIn(page, user.username, user.password);
    await expect(page.getByRole("button", { name: "Sign In" })).toHaveCount(0);

    // Meanwhile an admin sets a new password and requires a change
    const adminSet = strongPassword();
    await adminSetPassword(user.username, adminSet);

    // The session ends (as when it times out); the next request opens the dialog
    await context.clearCookies();
    await openPortal(page, "/requests");
    const dialog = page.locator("dialog[open]");
    await expect(dialog.getByLabel("Username")).toBeVisible();

    // Signing in with the admin-set password shows the change step in the dialog
    await signIn(page, user.username, adminSet);
    await expect(
      dialog.getByRole("heading", { name: "Change your password" }),
    ).toBeVisible();
    const newPassword = strongPassword();
    await dialog.getByLabel("New Password", { exact: true }).fill(newPassword);
    await dialog.getByLabel("Confirm New Password").fill(newPassword);
    await dialog.getByRole("button", { name: "Update Password" }).click();

    // The dialog closes and the page the user was on stays
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(page).toHaveURL(/#\/requests/);
  });
});
