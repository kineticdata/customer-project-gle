import { test, expect } from "@playwright/test";
import {
  createResetToken,
  createUser,
  deleteUser,
  openPortal,
  readSpaceSettings,
  requireSpaceChanges,
  strongPassword,
  TestUser,
  updateSpaceSettings,
} from "../passwordHelpers";

// Kinetic Platform 7.0: resetting a password with a reset token follows the space's password
// policy, and the page lists each rule a refused password breaks.
test.describe("reset password", () => {
  requireSpaceChanges();

  let user: TestUser;
  let saved: Record<string, any>;
  test.beforeAll(async () => {
    // A known minimum length for the test (restored afterwards)
    saved = await readSpaceSettings(["passwordPolicies"]);
    await updateSpaceSettings({ passwordPolicies: { minimumLength: 12 } });
  });
  test.afterAll(async () => {
    await updateSpaceSettings({
      passwordPolicies: { minimumLength: saved.passwordPolicies.minimumLength },
    });
  });
  test.beforeEach(async () => {
    user = await createUser();
  });
  test.afterEach(async () => {
    await deleteUser(user.username);
  });

  test("a password that breaks the policy is refused with its rule, then a valid one succeeds", async ({
    page,
  }) => {
    const token = await createResetToken(user.username);
    await openPortal(
      page,
      `/reset-password/${token}?u=${encodeURIComponent(user.username)}`,
    );

    // The checklist from the space's public policy
    await expect(page.getByText("At least 12 characters")).toBeVisible();
    await expect(
      page.getByText("Different from your current password"),
    ).toBeVisible();

    // Too short (10 characters): refused, with that rule's message
    const tooShort = "Kd!4short7";
    await page.getByLabel("New Password").fill(tooShort);
    await page.getByLabel("Confirm Password").fill(tooShort);
    await page.getByRole("button", { name: "Reset Password" }).click();
    await expect(page.getByRole("alert")).toContainText("at least 12");

    // The page can be corrected and submitted again
    const valid = strongPassword();
    await page.getByLabel("New Password").fill(valid);
    await page.getByLabel("Confirm Password").fill(valid);
    await page.getByRole("button", { name: "Reset Password" }).click();
    await expect(
      page.getByText("Password was successfully updated."),
    ).toBeVisible();
  });

  test("a used token is refused", async ({ page }) => {
    const token = await createResetToken(user.username);
    const path = `/reset-password/${token}?u=${encodeURIComponent(user.username)}`;
    const valid = strongPassword();
    await openPortal(page, path);
    await page.getByLabel("New Password").fill(valid);
    await page.getByLabel("Confirm Password").fill(valid);
    await page.getByRole("button", { name: "Reset Password" }).click();
    await expect(
      page.getByText("Password was successfully updated."),
    ).toBeVisible();

    await page.context().clearCookies();
    await openPortal(page, path);
    const again = strongPassword();
    await page.getByLabel("New Password").fill(again);
    await page.getByLabel("Confirm Password").fill(again);
    await page.getByRole("button", { name: "Reset Password" }).click();
    await expect(
      page.getByText("Expired or invalid password reset token."),
    ).toBeVisible();
  });
});
