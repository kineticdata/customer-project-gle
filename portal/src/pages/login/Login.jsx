import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { NOTICES } from '@kineticdata/react';
import logo from '../../assets/images/GLE-Logo.png';
import { ChangePassword } from './ChangePassword.jsx';

// Why the login screen is shown (loginProps.notice).
const NOTICE_TEXT = {
  [NOTICES.SIGNED_OUT]: 'You have been signed out.',
  [NOTICES.EXPIRED]: 'Your session expired. Please sign in again.',
};

/**
 * The space's login banner (loginProps.banner), shown before the username and password. Its text
 * is plain text, rendered as text with its line breaks kept (never as HTML). When the space
 * requires acknowledgment, the user checks the box before they can sign in.
 */
const LoginBanner = ({ banner, bannerAcknowledged, onAcknowledgeBanner }) => (
  <section className="flex-c-st gap-3 w-full" aria-label="Login banner">
    <div className="rounded-box border p-4 max-h-64 overflow-y-auto whitespace-pre-wrap">
      {banner.text}
    </div>
    {banner.requireAck && (
      <div className="field">
        <label className="flex-sc gap-2" htmlFor="banner-acknowledged">
          <input
            type="checkbox"
            id="banner-acknowledged"
            checked={!!bannerAcknowledged}
            onChange={onAcknowledgeBanner}
          />
          I have read and agree to the notice above
        </label>
      </div>
    )}
  </section>
);

export const LoginCardWrapper = ({ children }) => (
  <div className="flex-cc min-h-screen">
    <div className="kcard w-144 border m-4">
      <div className="kcard-body items-center p-5">{children}</div>
    </div>
  </div>
);

export const Login = loginProps => {
  const themeLogo = useSelector(state => state.theme.data?.logo?.default);

  // A sign in held for a forced password change shows that step instead (also in the
  // session-timeout dialog, which renders this component too).
  if (loginProps.requiredAction?.type === 'CHANGE_PASSWORD') {
    return (
      <LoginCardWrapper>
        <img
          src={themeLogo || logo}
          alt="Logo"
          className="logo my-5 self-center"
        />
        <ChangePassword {...loginProps} />
      </LoginCardWrapper>
    );
  }
  return <SignIn {...loginProps} themeLogo={themeLogo} />;
};

const SignIn = ({ themeLogo, ...loginProps }) => {
  const {
    banner,
    bannerAcknowledged,
    notice,
    onAcknowledgeBanner,
    error,
    onChangePassword,
    onChangeUsername,
    onLogin,
    externalSignIns = [],
    onExternalSignIn,
    password,
    pending,
    username,
  } = loginProps;
  // A login banner that must be acknowledged comes first: the credentials can't be entered until
  // then (as on the platform's own login page).
  const awaitingAcknowledgment = !!banner?.requireAck && !bannerAcknowledged;

  return (
    <LoginCardWrapper>
      <form className="flex-c-st gap-5 w-full max-w-96">
        <img
          src={themeLogo || logo}
          alt="Logo"
          className="logo my-5 self-center"
        />
        {NOTICE_TEXT[notice] && (
          <div className="kalert kalert-info" role="status">
            {NOTICE_TEXT[notice]}
          </div>
        )}
        {banner && (
          <LoginBanner
            banner={banner}
            bannerAcknowledged={bannerAcknowledged}
            onAcknowledgeBanner={onAcknowledgeBanner}
          />
        )}
        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            name="username"
            autoComplete="username"
            required={true}
            autoFocus
            disabled={awaitingAcknowledgment}
            value={username}
            onChange={onChangeUsername}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            name="password"
            autoComplete="current-password"
            required={true}
            disabled={awaitingAcknowledgment}
            value={password}
            onChange={onChangePassword}
          />
        </div>
        {error && (
          <p className="flex-sc gap-2 text-base-content/80">
            <span className="kstatus kstatus-error"></span>
            {error}
          </p>
        )}
        <button
          type="submit"
          className="kbtn kbtn-primary kbtn-lg"
          onClick={onLogin}
          disabled={pending || !username || !password || awaitingAcknowledgment}
        >
          Sign In
        </button>
        {/* One button per external sign in the space offers (SAML2, OpenID
            Connect, or both), labelled by the space's configuration. The login
            banner is for username and password sign in only. */}
        {externalSignIns.length > 0 && (
          <>
            <div className="flex justify-center items-center gap-2.5 text-base-content/60 font-semibold leading-4">
              <hr className="inline w-16 text-base-content/50" />
              OR
              <hr className="inline w-16 text-base-content/50" />
            </div>
            {externalSignIns.map(signIn => (
              <button
                key={signIn.strategy}
                type="button"
                className="kbtn kbtn-lg kbtn-outline"
                onClick={() => onExternalSignIn(signIn)}
                disabled={pending}
              >
                {signIn.displayName}
              </button>
            ))}
          </>
        )}
        <Link
          to="/reset-password"
          className={clsx(
            'flex justify-center items-center gap-1 text-base-content/60 py-2.5 font-semibold',
            'hover:underline hover:text-base-content',
          )}
        >
          Forgot your password?
        </Link>
      </form>
    </LoginCardWrapper>
  );
};
