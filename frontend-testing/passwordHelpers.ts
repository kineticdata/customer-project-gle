import { test, Page } from "@playwright/test";
import axios from "axios";
import { randomBytes } from "crypto";
import { TEST_DOMAIN, TEST_HOST, USERNAME, PASSWORD } from "./constants";

/*
 * Helpers for the password policy and banner specs (Kinetic Platform 7.0).
 *
 * These specs create users and change the space's login banner, Environment Banner and password
 * policy (and restore them afterwards), as the space admin in PW_USERNAME / PW_PASSWORD. They
 * only run when PW_SPACE_CHANGES_ALLOWED=true, against a 7.0 space you can change.
 */

export const SPACE_CHANGES_ALLOWED =
  process.env.PW_SPACE_CHANGES_ALLOWED === "true";

/** Skips the spec unless space changes are allowed (see above). */
export function requireSpaceChanges() {
  test.skip(
    !SPACE_CHANGES_ALLOWED,
    "Set PW_SPACE_CHANGES_ALLOWED=true to run against a 7.0 space you can change.",
  );
}

// The Core API as the space admin.
const api = axios.create({
  baseURL: `${TEST_DOMAIN}/app/api/v1`,
  auth: { username: USERNAME, password: PASSWORD },
  headers: { "Content-Type": "application/json" },
});

/**
 * A password that meets any reasonable policy: upper and lower case letters, digits and a special
 * character, 20 characters, random each time (not a credential).
 */
export function strongPassword(): string {
  return `Kd!${randomBytes(6).toString("hex")}7Zq-x`;
}

export type TestUser = { username: string; email: string; password: string };

/**
 * Creates a local user with an admin-set password. With mustChangePassword, the user must choose
 * a new password at their next sign in.
 */
export async function createUser(
  { mustChangePassword = false }: { mustChangePassword?: boolean } = {},
): Promise<TestUser> {
  const id = `pw-test-${Date.now()}-${randomBytes(3).toString("hex")}`;
  const user = { username: id, email: `${id}@example.test`, password: strongPassword() };
  await api.post("/users", {
    username: user.username,
    email: user.email,
    displayName: id,
    enabled: true,
    spaceAdmin: false,
    password: user.password,
    mustChangePassword,
  });
  if (!mustChangePassword) {
    // A space that forces a change whenever an admin sets a password marks the user anyway:
    // clear it (as an admin can in the console) so the user signs in directly.
    await api.put(`/users/${encodeURIComponent(user.username)}`, {
      mustChangePassword: false,
    });
  }
  return user;
}

/** Sets a user's password as the admin, requiring a change at next sign in. */
export async function adminSetPassword(username: string, password: string) {
  await api.put(`/users/${encodeURIComponent(username)}`, {
    password,
    mustChangePassword: true,
  });
}

export async function deleteUser(username: string) {
  await api.delete(`/users/${encodeURIComponent(username)}`).catch(() => {});
}

/** A password reset token for the user (what the reset email links to). */
export async function createResetToken(username: string): Promise<string> {
  const { data } = await api.post(
    `/users/${encodeURIComponent(username)}/passwordResetToken`,
    {},
  );
  return data.token;
}

/** Reads the space settings with the given keys (loginBanner, environmentBanner, passwordPolicies). */
export async function readSpaceSettings(keys: string[]) {
  const { data } = await api.get("/space", {
    params: { include: "details,passwordPolicies" },
  });
  return Object.fromEntries(keys.map(key => [key, data.space[key]]));
}

/** Updates space settings (only the keys given). */
export async function updateSpaceSettings(settings: Record<string, unknown>) {
  await api.put("/space", settings);
}

/** Signs in on the portal's login page with the given credentials. */
export async function signIn(page: Page, username: string, password: string) {
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

export async function openPortal(page: Page, path = "/") {
  await page.goto(`${TEST_HOST}/#${path}`);
}
