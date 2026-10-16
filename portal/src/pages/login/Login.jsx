import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import logo from '../../assets/images/GLE-Logo.png';

export const LoginCardWrapper = ({ children }) => (
  <div className="flex-cc min-h-screen">
    <div className="kcard w-144 border m-4">
      <div className="kcard-body items-center p-5">{children}</div>
    </div>
  </div>
);

export const Login = loginProps => {
  const {
    error,
    onChangePassword,
    onChangeUsername,
    onLogin,
    onSso,
    password,
    pending,
    username,
  } = loginProps;

  const themeLogo = useSelector(state => state.theme.data?.logo?.default);

  return (
    <LoginCardWrapper>
      <form className="flex-c-st gap-5 w-full max-w-96">
        <img
          src={themeLogo || logo}
          alt="Logo"
          className="logo my-5 self-center"
        />
        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            name="username"
            required={true}
            autoFocus
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
            required={true}
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
          disabled={pending || !username || !password}
        >
          Sign In
        </button>
        {onSso && (
          <>
            <div className="flex justify-center items-center gap-2.5 text-base-content/60 font-semibold leading-4">
              <hr className="inline w-16 text-base-content/50" />
              OR
              <hr className="inline w-16 text-base-content/50" />
            </div>
            <button
              type="button"
              className="kbtn kbtn-lg kbtn-outline"
              onClick={onSso}
              disabled={pending}
            >
              Enterprise Single Sign-On
            </button>
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
