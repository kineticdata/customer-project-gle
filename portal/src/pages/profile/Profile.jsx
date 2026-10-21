import { useSelector } from 'react-redux';
import { useState, useCallback, useEffect } from 'react';
import clsx from 'clsx';
import { fetchPasswordPolicy, updateProfile } from '@kineticdata/react';
import { Avatar } from '../../atoms/Avatar.jsx';
import { Icon } from '../../atoms/Icon.jsx';
import { signOut, validateEmail } from '../../helpers/index.js';
import { appActions } from '../../helpers/state.js';
import { toastError, toastSuccess } from '../../helpers/toasts.js';
import { PageHeading } from '../../components/PageHeading.jsx';
import { PasswordRequirements } from '../../components/password/PasswordRequirements.jsx';

export const Profile = () => {
  const { profile } = useSelector(state => state.app);
  const [newPassword, setNewPassword] = useState('');
  // Required by some spaces to change the password (the server decides)
  const [currentPassword, setCurrentPassword] = useState('');
  // The rules the server refused the new password for ({ rule, message })
  const [ruleErrors, setRuleErrors] = useState([]);
  // The space's password policy, for the requirements checklist
  const [policy, setPolicy] = useState(null);
  useEffect(() => {
    fetchPasswordPolicy().then(({ passwordPolicy }) =>
      setPolicy(passwordPolicy || null),
    );
  }, []);
  const [showPassword, setShowPassword] = useState(false);
  const [showChangedPassword, setShowChangedPassword] = useState(false);
  const [newEmail, setNewEmail] = useState(profile.email);
  const [newDisplayName, setNewDisplayName] = useState(profile.displayName);
  const [validationErrors, setValidationErrors] = useState({
    newEmail: '',
    newDisplayName: '',
    newPassword: '',
  });

  const saveProfile = useCallback(
    async e => {
      e.preventDefault();

      // Validate the fields
      const newValidationErrors = {
        newEmail:
          newEmail.length <= 0
            ? 'Email is required'
            : !validateEmail(newEmail)
              ? 'Invalid email format'
              : '',
        newDisplayName:
          newDisplayName.length <= 0 ? 'Display Name is required.' : '',
        newPassword:
          showChangedPassword && newPassword.length <= 0
            ? 'Password is required.'
            : '',
      };
      // Update the validations state
      setValidationErrors(newValidationErrors);

      if (Object.values(newValidationErrors).some(o => o)) {
        return;
      }

      let newProfileData = { displayName: newDisplayName, email: newEmail };
      if (showChangedPassword && newPassword.length > 0) {
        newProfileData.password = newPassword;
        if (currentPassword.length > 0) {
          newProfileData.currentPassword = currentPassword;
        }
      }

      setRuleErrors([]);
      updateProfile({
        profile: newProfileData,
      }).then(({ error, profile }) => {
        if (!error) {
          toastSuccess({ title: 'Your profile has been updated.' });
          appActions.updateProfile(profile);
          // Not kept for a later change in the same visit
          setCurrentPassword('');
        } else if (
          Array.isArray(error.errors) &&
          error.errors.some(e => e.rule)
        ) {
          // The new password breaks the space's password policy: show each rule under it.
          setRuleErrors(error.errors.filter(e => e.rule));
        } else {
          toastError({
            title: 'Profile update failed.',
            description: error.message,
          });
        }
      });
    },
    [
      newPassword,
      currentPassword,
      newDisplayName,
      showChangedPassword,
      newEmail,
    ],
  );

  return (
    <div className="gutter">
      <div className="max-w-screen-md mx-auto pt-1 pb-6">
        <PageHeading title="My Profile" backTo="/" />
        <div className={clsx('rounded-box md:border md:p-8 flex-c-st gap-6')}>
          <div className="flex-cc mb-4">
            <Avatar username={profile.username} size="2xl" />
          </div>
          <form className="flex-c-st gap-6 w-full pb-6">
            <div
              className={clsx('field required', {
                'has-error': validationErrors.newEmail,
              })}
            >
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="text"
                name="email"
                required={true}
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
              />
              {validationErrors.newEmail && (
                <p className="flex-sc gap-2 text-base-content/60">
                  <span className="kstatus kstatus-error"></span>
                  {validationErrors.newEmail}
                </p>
              )}
            </div>
            <div
              className={clsx('field required', {
                'has-error': validationErrors.newDisplayName,
              })}
            >
              <label htmlFor="displayName">Display Name</label>
              <input
                id="displayName"
                type="text"
                name="displayName"
                required={true}
                value={newDisplayName}
                onChange={e => setNewDisplayName(e.target.value)}
              />
              {validationErrors.newDisplayName && (
                <p className="flex-sc gap-2 text-base-content/60">
                  <span className="kstatus kstatus-error"></span>
                  {validationErrors.newDisplayName}
                </p>
              )}
            </div>
            {showChangedPassword && (
              <div className="field">
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  id="currentPassword"
                  type={showPassword ? 'text' : 'password'}
                  name="currentPassword"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                />
                <p className="text-base-content/60">
                  Required by some spaces to change your password.
                </p>
              </div>
            )}
            {showChangedPassword && (
              <div
                className={clsx('field required', {
                  'has-error':
                    validationErrors.newPassword || ruleErrors.length > 0,
                })}
              >
                <label htmlFor="password">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="new-password"
                    required={true}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="pr-12"
                  />
                  <button
                    type="button"
                    className="kbtn kbtn-ghost kbtn-xs kbtn-circle absolute right-3 top-2 z-1"
                    onClick={() => setShowPassword(prev => !prev)}
                    aria-label={`${showPassword ? 'Hide Password' : 'Show Password'}`}
                  >
                    <Icon name={showPassword ? 'eye-off' : 'eye'} />
                  </button>
                </div>
                {validationErrors.newPassword && (
                  <p className="flex-sc gap-2 text-base-content/60">
                    <span className="kstatus kstatus-error"></span>
                    {validationErrors.newPassword}
                  </p>
                )}
                {ruleErrors.map(e => (
                  <p
                    key={e.rule}
                    className="flex-sc gap-2 text-base-content/60"
                    role="alert"
                  >
                    <span className="kstatus kstatus-error"></span>
                    {e.message}
                  </p>
                ))}
                <PasswordRequirements
                  policy={policy}
                  password={newPassword}
                  user={{ username: profile.username, email: newEmail }}
                  changingOwnPassword
                />
              </div>
            )}
            <button
              type="button"
              className="kbtn kbtn-ghost kbtn-xs self-end -mt-3"
              onClick={() => {
                // Cancelling the change also forgets the current password
                if (showChangedPassword) setCurrentPassword('');
                setShowChangedPassword(!showChangedPassword);
              }}
            >
              {showChangedPassword === false ? 'Change Password' : 'Cancel'}
            </button>

            <button
              type="submit"
              className="kbtn kbtn-primary kbtn-lg w-70 self-center mt-6"
              onClick={saveProfile}
              disabled={
                profile.email === newEmail &&
                profile.displayName === newDisplayName &&
                !showChangedPassword
              }
            >
              Save
            </button>
          </form>
          <hr />
          <div className="flex-c-st gap-6 w-full">
            <button
              type="button"
              onClick={signOut}
              className="kbtn kbtn-ghost kbtn-lg text-base text-base-content/80 w-70 self-center mt-6"
            >
              <Icon name="logout" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
