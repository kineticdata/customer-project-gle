import { useState } from 'react';
import t from 'prop-types';
import clsx from 'clsx';
import { Icon } from '../../atoms/Icon.jsx';
import { PasswordRequirements } from '../../components/password/PasswordRequirements.jsx';

// Why the user has to change their password (requiredAction.reason).
const REASONS = {
  ADMIN_SET:
    'An administrator set your password. Choose a new one to finish signing in.',
};
const DEFAULT_REASON = 'You must change your password to finish signing in.';

const ErrorText = ({ children }) => (
  <p className="flex-sc gap-2 text-base-content/80">
    <span className="kstatus kstatus-error"></span>
    {children}
  </p>
);

/**
 * The forced password change step of sign in (loginProps.requiredAction.type is
 * 'CHANGE_PASSWORD'). The sign in is held until the new password is saved; "Sign Out" ends it.
 * Takes the loginProps of KineticLib, and is rendered inside the login card.
 */
export const ChangePassword = ({
  requiredAction,
  passwordPolicy,
  username,
  newPassword,
  confirmPassword,
  passwordErrors = [],
  error,
  pending,
  onChangeNewPassword,
  onChangeConfirmPassword,
  onSubmitPasswordChange,
  onCancelPasswordChange,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const type = showPassword ? 'text' : 'password';
  const confirmError = passwordErrors.find(e => e.rule === 'confirmPassword');
  const ruleErrors = passwordErrors.filter(e => e.rule !== 'confirmPassword');

  return (
    <form
      className="flex-c-st gap-5 w-full max-w-96"
      onSubmit={onSubmitPasswordChange}
    >
      <h1 className="text-xl font-semibold">Change your password</h1>
      <p>{REASONS[requiredAction.reason] || DEFAULT_REASON}</p>

      {/* Lets password managers save the new password for the right account. */}
      <input
        type="text"
        name="username"
        autoComplete="username"
        value={username || ''}
        readOnly
        hidden
      />

      <div className="field">
        <label htmlFor="new-password">New Password</label>
        <div className="relative">
          <input
            id="new-password"
            type={type}
            name="new-password"
            autoComplete="new-password"
            autoFocus
            required={true}
            value={newPassword}
            onChange={onChangeNewPassword}
            aria-describedby="password-requirements-title"
            className="pr-12"
          />
          <button
            type="button"
            className="kbtn kbtn-ghost kbtn-xs kbtn-circle absolute right-3 top-2 z-1"
            onClick={() => setShowPassword(prev => !prev)}
            aria-label={showPassword ? 'Hide Passwords' : 'Show Passwords'}
          >
            <Icon name={showPassword ? 'eye-off' : 'eye'} />
          </button>
        </div>
      </div>
      <div className={clsx('field', { 'has-error': confirmError })}>
        <label htmlFor="confirm-password">Confirm New Password</label>
        <input
          id="confirm-password"
          type={type}
          name="confirm-password"
          autoComplete="new-password"
          required={true}
          value={confirmPassword}
          onChange={onChangeConfirmPassword}
        />
        {confirmError && <ErrorText>{confirmError.message}</ErrorText>}
      </div>

      <PasswordRequirements
        policy={passwordPolicy}
        password={newPassword}
        user={{ username }}
        changingOwnPassword
      />

      {/* The server's errors, as text. */}
      {ruleErrors.length > 0 ? (
        <ul className="flex-c-st gap-1" role="alert">
          {ruleErrors.map(e => (
            <li key={e.rule}>
              <ErrorText>{e.message}</ErrorText>
            </li>
          ))}
        </ul>
      ) : (
        error && !confirmError && <ErrorText>{error}</ErrorText>
      )}

      <button
        type="submit"
        className="kbtn kbtn-primary kbtn-lg"
        disabled={pending || !newPassword || !confirmPassword}
      >
        Update Password
      </button>
      <button
        type="button"
        className="kbtn kbtn-ghost kbtn-lg"
        onClick={() => onCancelPasswordChange()}
        disabled={pending}
      >
        Sign Out
      </button>
    </form>
  );
};

ChangePassword.propTypes = {
  requiredAction: t.object.isRequired,
  passwordPolicy: t.object,
  username: t.string,
  newPassword: t.string,
  confirmPassword: t.string,
  passwordErrors: t.array,
  error: t.string,
  pending: t.bool,
  onChangeNewPassword: t.func,
  onChangeConfirmPassword: t.func,
  onSubmitPasswordChange: t.func,
  onCancelPasswordChange: t.func,
};
