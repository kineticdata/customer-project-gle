# Updating a customized Momentum Portal for 7.0 password policies and banners

This guide is for teams who copied the Momentum Portal source and customized it. It shows how to bring your copy in line with the password policy, login banner and Environment Banner support in Kinetic Platform 7.0, one step at a time. Each step matches one commit in the Momentum Portal repository, so you can compare your copy against it or cherry-pick it.

If you use Momentum Portal unmodified, take the Momentum Portal release for Kinetic Platform 7.0 instead.

## Who needs this

- **Portals where users sign in with a username and password.** Do all the steps. For LDAP users, only the login banner and the signed-out/expired messages apply; password rules, forced changes, the current-password check and the previous sign-in notice are for local users (passwords stored in the platform).
- **Portals where everyone signs in through SAML, OpenID Connect or a reverse proxy** (no username/password form) don't need steps 2–5 for users. Those users have no platform password, and the login banner is never shown for external sign-in.
  - Still do **Step 6** if any of your spaces shows an **Environment Banner** (for example a classification marking). It appears for every user, before and after sign-in.

## What happens if you don't upgrade

Nothing changes until an administrator turns a feature on. Upgraded spaces keep their 6.x behaviour, and new 7.0 spaces start with a password policy but no banners. Once a feature is on, a portal that hasn't been updated keeps working, with these limits:

| Feature turned on | What users of a non-updated portal see |
| -- | -- |
| **Forced password change** (an admin set the user's password) | Sign-in fails with the readable message "You must change your password before you can sign in. Change it at …/app/change-password." The user changes it on the **platform's change-password page** (Core-hosted), which signs them in. They can then return to the portal. |
| **Login banner with required acknowledgment** | Sign-in fails with "You must acknowledge the login banner before signing in. Reload the sign-in page, or sign in at …/app/login." The user signs in on the **platform's login page**, which shows the banner. |
| **Login banner without acknowledgment** | Nothing; the portal just doesn't show the banner. |
| **Environment Banner** | The bar appears on the platform's own pages, but **not** in the portal. |
| **Stricter password rules** (reset page, profile) | The password is refused with the server's combined message. Your page shows no checklist, so users find out only when they save. |
| **Current password required to change it** (the default for new 7.0 spaces) | The profile page's password change is refused: "The current password is required to change the password." |
| **Previous sign-in notice** | Not shown in the portal. |

## Prerequisites

- **Kinetic Core 7.0.0-rc4 or later.**
- **`@kineticdata/react` 7.0.0-rc4.** Earlier release candidates don't have these APIs. All `@kineticdata/*` libraries in a bundle must be on the same exact version.
- **A Momentum Portal based on 7.0** (the `epic/spring-boot` line).
- **The external sign-in changes from the 7.0 sign-in guide** (Momentum commit [`b5dec0d`](https://github.com/kineticdata/momentum-portal/commit/b5dec0d), "Sign in with the space's external sign-ins and sign out through the library"). This guide's login page changes build on that version of `Login.jsx`.

## The toolkit features this uses

All of these come from `@kineticdata/react` (see its CHANGELOG, "7.0"):

| API | What it gives the portal |
| -- | -- |
| `loginProps.requiredAction` | `{ type: 'CHANGE_PASSWORD', reason }` while a sign-in is held for a forced password change, otherwise `null`. `loggedIn` stays false until the change is made. |
| `loginProps.passwordPolicy`, `newPassword`, `confirmPassword`, `passwordErrors`, `onChangeNewPassword`, `onChangeConfirmPassword`, `onSubmitPasswordChange`, `onCancelPasswordChange` | Everything the change step needs. `passwordErrors` are `[{ rule, message }]` from the server (`rule` is `confirmPassword` when the confirmation doesn't match). Cancel signs out. |
| `loginProps.banner`, `bannerAcknowledged`, `onAcknowledgeBanner` | The login banner (`{ text, requireAck, hash }` or `null`) and its acknowledgment. The toolkit refuses `onLogin` until a required banner is acknowledged. |
| `loginProps.notice` | `NOTICES.SIGNED_OUT` or `NOTICES.EXPIRED`, or `null`. |
| `previousSignIn` (render prop, next to `loggedIn`) | `{ at, ip, failedSignIns }` after a username/password sign-in when the space shows the notice. |
| `EnvironmentBanner` | The space's Environment Banner, drawn the same as on the platform's pages. |
| `evaluatePasswordPolicy(policy, password, { username, email }, { changingOwnPassword })` | The requirements checklist, `[{ rule, label, met, serverOnly }]`. |
| `fetchPasswordPolicy()`, `resetPassword(…)` | The public password policy, and a password reset with a reset token. |

**Security notes** for every step:
- **Render all server and administrator text as text**: the banner, error messages and rule messages. Never use `dangerouslySetInnerHTML`.
- The browser checklist is a guide only. The server always checks the password again.

## Step 1: Upgrade `@kineticdata/react`

No commit of its own: the version is set by the 7.0 sign-in changes (Momentum commit [`b5dec0d`](https://github.com/kineticdata/momentum-portal/commit/b5dec0d)), and `7.0.0-rc4` also carries everything this guide uses. If you already did the 7.0 sign-in guide, there's nothing more to change here.

Otherwise, in `portal/package.json`, set `@kineticdata/react` to **`7.0.0-rc4`**, then run `yarn install` so `yarn.lock` is updated too.

## Step 2: Add the new components

Commit: [`2844cd7`](https://github.com/kineticdata/momentum-portal/commit/2844cd7)

Add these four files. They're only used by the later steps, so this step on its own changes nothing on screen.

**`portal/src/components/password/PasswordRequirements.jsx`**: a live checklist. It shows each rule the space turns on, met or not, as the user types.
- Rules only the server can check are marked "Checked when you save" (for example "Doesn't contain your username or email address" when the email isn't known).
- The list uses `aria-live="polite"` so screen readers announce changes.

```jsx
const requirements = evaluatePasswordPolicy(policy, password, user, {
  changingOwnPassword,
});
// one <li> per requirement: icon + requirement.label + sr-only "Met" / "Not met" / "Checked when you save"
```

Pass `changingOwnPassword` wherever users set their own password: the forced change step, the profile page and the reset password page. It adds "Different from your current password", which the server checks.

**`portal/src/pages/login/ChangePassword.jsx`**: the forced change step, rendered inside the login card.
- A short reason text (for `ADMIN_SET`: "An administrator set your password. Choose a new one to finish signing in.").
- New and confirm password with a show/hide toggle, both `autoComplete="new-password"`.
- **A hidden username field**, so password managers save the new password for the right account. Keep it as the `hidden` attribute (not CSS):
  ```jsx
  <input type="text" name="username" autoComplete="username" value={username || ''} readOnly hidden />
  ```
- The checklist, and the server's `passwordErrors` as text. A `confirmPassword` error goes on the confirm field.
- **Update Password** submits with `onSubmitPasswordChange`; **Sign Out** calls `onCancelPasswordChange()`.

**`portal/src/components/banners/EnvironmentBanners.jsx`**: the toolkit `EnvironmentBanner` in a `flex-none` wrapper, used at the top and (`placement="bottom"`) at the bottom.

**`portal/src/components/banners/PreviousSignIn.jsx`**: "Last successful sign-in: … from …. N failed attempts since then.", dismissible. It remembers which notice was dismissed, so the notice of a later sign-in (for example after a session timeout) shows again.

## Step 3: The login page

Commit: [`3d0c0b2`](https://github.com/kineticdata/momentum-portal/commit/3d0c0b2)

In `portal/src/pages/login/Login.jsx`:

1. **Show the change step while the sign-in is held.** This also covers the session-timeout dialog, which renders the same `Login` component:
   ```jsx
   if (loginProps.requiredAction?.type === 'CHANGE_PASSWORD') {
     return (
       <LoginCardWrapper>
         {/* logo */}
         <ChangePassword {...loginProps} />
       </LoginCardWrapper>
     );
   }
   return <SignIn {...loginProps} />;   // the existing sign-in form
   ```
2. **Show the notice** (`loginProps.notice`) with your own text, for example "You have been signed out." and "Your session expired. Please sign in again.".
3. **Show the login banner** above the username, as text with its line breaks kept (`whitespace-pre-wrap`). When `banner.requireAck` is set:
   - add the acknowledgment checkbox (`checked={!!bannerAcknowledged}`, `onChange={onAcknowledgeBanner}`);
   - keep the username, password and **Sign In** disabled until it's checked, as the platform's own login page does.

   Leave the external sign-in buttons enabled: the banner is for username and password sign-in only.
4. **Add `autoComplete="username"`** and **`"current-password"`** to the sign-in fields.

## Step 4: The reset password page

Commit: [`5d2ca74`](https://github.com/kineticdata/momentum-portal/commit/5d2ca74)

In `portal/src/pages/login/ResetPassword.jsx`, replace the hand-written `fetch` to `/app/reset-password/token` with the toolkit's `resetPassword()`:

```jsx
const { error, loginRequired } = await resetPassword({
  username, token, password, confirmPassword,
  csrfToken: getCsrfToken(),
});
if (!error) {
  // go home; if loginRequired, tell the user to sign in with the new password
} else if (error.errors?.length) {
  // the password breaks the policy: list each { rule, message } and let them try again
} else {
  // error.message (for example "Expired or invalid password reset token.")
}
```

- **Pass `csrfToken: getCsrfToken()`.** A reset is a form post that the platform checks for its CSRF token. A portal served from another origin can't send it any other way.
- **`loginRequired`** is true when the space requires its login banner to be acknowledged. The reset then doesn't sign the user in, and they sign in with the new password (where the banner is shown).
- **Add the checklist** with the space's public policy (`fetchPasswordPolicy()`) and `changingOwnPassword` (a reset can't keep the current password either). Only the username is known on this page, so the username/email rule shows as checked on save.
- Add `autoComplete="new-password"` to both password fields.
- The reset *request* (the `account-password-reset` form, driven by your workflow) is unchanged.

## Step 5: The profile page

Commit: [`4c0b707`](https://github.com/kineticdata/momentum-portal/commit/4c0b707)

In `portal/src/pages/profile/Profile.jsx`:
- While **Change Password** is open, add a **Current Password** field (`autoComplete="current-password"`), with the help text "Required by some spaces to change your password."
  - Send it as `currentPassword` only with a new password, and only when it's filled in. The space decides whether it's required.
  - Clear it after a successful save and when the password change is cancelled, so it isn't sent with a later change.
- Add the checklist under the new password, with `changingOwnPassword` and the user's username and email, so every rule is checked as they type.
- When the save is refused for the policy (`error.errors` with a `rule`), show each message under the password field.
- Add `autoComplete="new-password"` to the new password.

## Step 6: The Environment Banner and the previous sign-in notice

Commit: [`d93d078`](https://github.com/kineticdata/momentum-portal/commit/d93d078)

In `portal/src/App.jsx`:
- Put `<EnvironmentBanners />` just **before** `<header id="app-header">`, and `<EnvironmentBanners placement="bottom" />` just **after** `<footer id="app-footer">`.
  - They are in the page flow, so they never cover content.
  - They show before and after sign-in.
  - The bottom bar only appears when the space places the banner at the top and bottom.
- The session-timeout `<dialog>` covers the page, so render `<EnvironmentBanners />` inside it, above `<Login {...loginProps} />`.
- Take the new `previousSignIn` prop and render `<PreviousSignIn previousSignIn={previousSignIn} />` under the header while signed in.

## Step 7: Automated tests (optional)

Commit: [`8482863`](https://github.com/kineticdata/momentum-portal/commit/8482863)

The Momentum Portal Playwright suite (`frontend-testing`) has specs for these cases. They need a 7.0 space, and they change the space's banners and minimum password length (restoring them afterwards), so they only run with `PW_SPACE_CHANGES_ALLOWED=true` (see `frontend-testing/README.md`). Never set it for a shared environment.

| Spec | Covers |
| -- | -- |
| `tests/passwordChange.spec.ts` | a forced change ends signed in; a confirmation that doesn't match; Sign Out ends the held sign-in; the old password no longer works |
| `tests/passwordChangeTimeout.spec.ts` | a forced change inside the session-timeout dialog continues the session |
| `tests/resetPassword.spec.ts` | a reset with a password that breaks the policy lists the rule, then a valid one succeeds; a used token is refused |
| `tests/loginBanner.spec.ts` | the credentials can be entered only after acknowledgment; a banner changed during sign-in is shown again |
| `tests/environmentBanner.spec.ts` | the bar before and after sign-in, above the header; at the bottom for "top and bottom"; hidden when off |

They share `frontend-testing/passwordHelpers.ts` (admin API calls through `PW_USERNAME` / `PW_PASSWORD`).

## Verify

Use a test space on Core 7.0.0-rc4 or later.

**Forced password change**
- [ ] An admin sets a user's password, requiring a change at next sign-in. That user signs in, sees **Change your password**, and the checklist ticks as they type.
- [ ] A password that breaks a rule is refused with that rule's message. A valid one lands the user signed in on the portal home.
- [ ] **Sign Out** on the change step returns to the login page.
- [ ] Inside the session-timeout dialog, the same step appears when the change is required, and completing it continues the session.

**Login banner**
- [ ] Turn on the login banner with acknowledgment. The banner shows above the username, with its line breaks. The fields and **Sign In** stay disabled until the box is checked, then sign-in works.
- [ ] External sign-in buttons work without the acknowledgment.

**Notices**
- [ ] After signing out, the login page says "You have been signed out." After a session timeout, it says "Your session expired. Please sign in again."
- [ ] With the previous sign-in notice on, signing in with a username and password shows the last sign-in time, IP address and failed attempts.

**Reset password**
- [ ] Following a reset link, a password that breaks the policy lists each rule and can be corrected. A valid password succeeds.
- [ ] In a space that requires banner acknowledgment, the success message asks the user to sign in with the new password.

**Profile**
- [ ] Changing the password shows the current password field and the checklist. In a space that requires it, a missing current password is refused, and a correct one succeeds.

**Environment Banner**
- [ ] Turn on the Environment Banner. It is visible on the login page and after sign-in, at the top (and at the bottom for "top and bottom"), and it doesn't cover the header or footer.

## Troubleshooting

| Symptom | Likely cause |
| -- | -- |
| "You must change your password before you can sign in. Change it at …" on your portal's login page | The portal's `@kineticdata/react` is older than 7.0.0-rc4, or Step 3 is missing. |
| "You must acknowledge the login banner …" although the box was checked | The banner text changed since the page loaded. The toolkit reloads it: check the box again. |
| The checklist never appears | The space's public password policy couldn't be read (`fetchPasswordPolicy()`). Check that Core is 7.0.0-rc4 or later. |
| A password that looked fine is refused | The server is authoritative. Rules marked "Checked when you save" (for example "Different from your current password") are only checked there. |
| A reset fails with a 403 from a portal on another domain | `csrfToken: getCsrfToken()` isn't passed to `resetPassword()` (Step 4). |
| The Environment Banner overlaps content | It was placed with fixed or absolute positioning. Keep it in the page flow, as in Step 6. |
| The profile page's password change fails with "The current password is required …" | Step 5 is missing, or the field was left empty in a space that requires it. |
| After an unchanged-password attempt, "The new password must be different from the current password." | Expected: the space refuses to keep the same password. |
