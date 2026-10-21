import t from 'prop-types';
import clsx from 'clsx';
import { evaluatePasswordPolicy } from '@kineticdata/react';
import { Icon } from '../../atoms/Icon.jsx';

// How each requirement is shown: an icon, and text for screen readers.
const STATUS = {
  met: { icon: 'check', text: 'Met', className: 'text-success' },
  unmet: { icon: 'x', text: 'Not met', className: 'text-error' },
  server: {
    icon: 'point',
    text: 'Checked when you save',
    className: 'text-base-content/60',
  },
};

const statusOf = ({ met, serverOnly }) =>
  serverOnly ? STATUS.server : met ? STATUS.met : STATUS.unmet;

/**
 * The space's password requirements, checked as the user types (the server checks again when the
 * password is saved).
 */
export const PasswordRequirements = ({
  policy,
  password,
  user,
  changingOwnPassword = false,
}) => {
  const requirements = evaluatePasswordPolicy(policy, password, user, {
    changingOwnPassword,
  });
  if (requirements.length === 0) return null;
  return (
    <div className="flex-c-st gap-1 w-full">
      <p id="password-requirements-title" className="font-semibold">
        Your password must have:
      </p>
      <ul
        className="flex-c-st gap-1"
        aria-labelledby="password-requirements-title"
        aria-live="polite"
      >
        {requirements.map(requirement => {
          const status = statusOf(requirement);
          return (
            <li
              key={requirement.rule}
              data-rule={requirement.rule}
              className="flex-sc gap-2"
            >
              <Icon
                name={status.icon}
                size={16}
                className={clsx('flex-none', status.className)}
                aria-hidden="true"
              />
              <span>{requirement.label}</span>
              <span className="sr-only">({status.text})</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

PasswordRequirements.propTypes = {
  /** The public password policy (loginProps.passwordPolicy or fetchPasswordPolicy). */
  policy: t.object,
  password: t.string,
  /** `{ username, email }`; the username/email rule is only checked when both are known. */
  user: t.object,
  /** True when users change their own password ("Different from your current password"). */
  changingOwnPassword: t.bool,
};
