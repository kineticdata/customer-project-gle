import { useCallback, useEffect, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  createSubmission,
  fetchPasswordPolicy,
  getCsrfToken,
  resetPassword,
} from '@kineticdata/react';
import { useSelector } from 'react-redux';
import { toastSuccess } from '../../helpers/toasts.js';
import { LoginCardWrapper } from './Login.jsx';
import logo from '../../assets/images/GLE-Logo.png';
import { Icon } from '../../atoms/Icon.jsx';
import { PasswordRequirements } from '../../components/password/PasswordRequirements.jsx';

export const ResetPassword = () => {
  let { token } = useParams();
  let [searchParams] = useSearchParams();

  return (
    <LoginCardWrapper>
      <div className="flex-ss w-full">
        <Link
          to="./.."
          className="kbtn kbtn-circle kbtn-ghost kbtn-lg"
          aria-label="Back to Login"
        >
          <Icon name="arrow-left" />
        </Link>
      </div>
      {token ? (
        <ResetPasswordChangeForm
          token={token}
          username={decodeURIComponent(searchParams.get('u'))}
        />
      ) : (
        <ResetPasswordRequestForm />
      )}
    </LoginCardWrapper>
  );
};

const ResetPasswordRequestForm = () => {
  const kappSlug = useSelector(state => state.app.kappSlug);
  const themeLogo = useSelector(state => state.theme.data?.logo?.default);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  // State for username field
  const [username, setUsername] = useState('');
  const onChangeUsername = useCallback(e => {
    setUsername(e.target.value);
  }, []);

  // Handler to request password reset
  const submitRequest = useCallback(
    async e => {
      e.preventDefault();
      const { error } = await createSubmission({
        kappSlug,
        formSlug: 'account-password-reset',
        values: { Username: username },
        public: true,
      });

      if (error) {
        setError('There was a problem requesting a password reset.');
      } else {
        setSubmitted(true);
      }
    },
    [username, kappSlug],
  );

  return (
    <form className="flex-c-st gap-5 w-full max-w-96 pb-8">
      <img
        src={themeLogo || logo}
        alt="Logo"
        className="logo mb-5 self-center"
      />
      <div className="field">
        <label htmlFor="username">Username</label>
        <input
          id="email"
          type="text"
          name="username"
          required={true}
          autoFocus
          value={username}
          onChange={onChangeUsername}
          disabled={submitted}
        />
      </div>
      {submitted && (
        <p>
          Your request has been submitted. You should receive an email with a
          password reset link shortly.
        </p>
      )}
      {error && (
        <p className="flex-sc gap-2 text-base-content/80">
          <span className="kstatus kstatus-error"></span>
          {error}
        </p>
      )}
      <button
        type="submit"
        className="kbtn kbtn-lg kbtn-primary"
        onClick={submitRequest}
        disabled={!username || submitted}
      >
        Reset Password
      </button>
    </form>
  );
};

const ResetPasswordChangeForm = ({ token, username }) => {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  // The rules the server refused the password for ({ rule, message })
  const [ruleErrors, setRuleErrors] = useState([]);
  const themeLogo = useSelector(state => state.theme.data?.logo?.default);

  // The space's password policy, for the requirements checklist
  const [policy, setPolicy] = useState(null);
  useEffect(() => {
    fetchPasswordPolicy().then(({ passwordPolicy }) =>
      setPolicy(passwordPolicy || null),
    );
  }, []);

  // State and change handlers for new password fields
  const [password, setPassword] = useState('');
  const onChangePassword = useCallback(e => {
    setPassword(e.target.value);
  }, []);
  const [confirmPassword, setConfirmPassword] = useState('');
  const onChangeConfirmPassword = useCallback(e => {
    setConfirmPassword(e.target.value);
  }, []);

  // State for tracking when each password field has been touched so that we
  // can start validating them after both have been filled out. Start with an
  // array with both field names, and use a blur handler to remove the ones
  // that have been touched.
  const [untouchedFields, setUntouchedFields] = useState([
    'password',
    'passwordConfirmation',
  ]);
  const onBlurPasswordField = useCallback(e => {
    setUntouchedFields(fields =>
      fields.filter(field => field !== e.target.name),
    );
  }, []);
  // Only check password mismatch after both fields have been touched
  const passwordMismatch =
    untouchedFields.length === 0 && password !== confirmPassword;

  // Handler to submit the new password
  const submitRequest = useCallback(
    async e => {
      e.preventDefault();
      setSubmitted(true);
      setError(null);
      setRuleErrors([]);
      const { error, loginRequired } = await resetPassword({
        username,
        token,
        password,
        confirmPassword,
        csrfToken: getCsrfToken(),
      });

      if (!error) {
        navigate('/', { state: { persistToasts: true } });
        toastSuccess({
          title: 'Password was successfully updated.',
          // When the space requires its login banner to be acknowledged, the reset doesn't sign
          // the user in: they sign in with the new password, where the banner is shown.
          description: loginRequired
            ? 'Sign in with your new password.'
            : undefined,
        });
      } else if (Array.isArray(error.errors) && error.errors.length > 0) {
        // The password breaks the space's password policy: show each rule, and let them try again.
        setRuleErrors(error.errors);
        setSubmitted(false);
      } else {
        setError(
          error.message ||
            'There was a problem resetting your password! Please note that password reset links may only be used once.',
        );
      }
    },
    [navigate, username, password, confirmPassword, token],
  );

  return (
    <form className="flex-c-st gap-5 w-full max-w-96 pb-8">
      <img
        src={themeLogo || logo}
        alt="Logo"
        className="logo mb-5 self-center"
      />
      {!token || !username ? (
        <>The reset password link is invalid.</>
      ) : (
        <>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="email"
              type="text"
              name="username"
              required={true}
              value={username}
              disabled={true}
            />
          </div>
          <div className="field">
            <label htmlFor="password">New Password</label>
            <input
              id="password"
              type="password"
              name="password"
              autoComplete="new-password"
              required={true}
              disabled={submitted}
              value={password}
              onChange={onChangePassword}
              onBlur={onBlurPasswordField}
            />
          </div>
          <div className="field">
            <label htmlFor="passwordConfirmation">Confirm Password</label>
            <input
              id="passwordConfirmation"
              type="password"
              name="passwordConfirmation"
              autoComplete="new-password"
              required={true}
              disabled={submitted}
              value={confirmPassword}
              onChange={onChangeConfirmPassword}
              onBlur={onBlurPasswordField}
            />
          </div>
          {/* The user sets their own password here, so it must also differ from the current one */}
          <PasswordRequirements
            policy={policy}
            password={password}
            user={{ username }}
            changingOwnPassword
          />
          {ruleErrors.length > 0 && (
            <ul className="flex-c-st gap-1" role="alert">
              {ruleErrors.map(e => (
                <li key={e.rule} className="flex-sc gap-2 text-base-content/80">
                  <span className="kstatus kstatus-error"></span>
                  {e.message}
                </li>
              ))}
            </ul>
          )}
          {passwordMismatch && (
            <p className="flex-sc gap-2 text-base-content/80">
              <span className="kstatus kstatus-error"></span>
              Passwords must match.
            </p>
          )}
          {error && (
            <p className="flex-sc gap-2 text-base-content/80">
              <span className="kstatus kstatus-error"></span>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="kbtn kbtn-lg kbtn-primary"
            onClick={submitRequest}
            disabled={
              submitted || !password || !confirmPassword || passwordMismatch
            }
          >
            Reset Password
          </button>
        </>
      )}
    </form>
  );
};
