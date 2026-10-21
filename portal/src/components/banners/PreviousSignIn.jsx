import { useState } from 'react';
import t from 'prop-types';
import { Icon } from '../../atoms/Icon.jsx';

const formatTime = at => {
  const date = new Date(at);
  return isNaN(date.getTime()) ? at : date.toLocaleString();
};

/**
 * The previous sign-in notice (the previousSignIn render prop of KineticLib), shown after a
 * username and password sign in when the space turns it on. The user can dismiss it; the notice
 * of a later sign in (for example after the session timed out) is shown again.
 */
export const PreviousSignIn = ({ previousSignIn }) => {
  // The notice that was dismissed, so a new one (a new object) is not hidden.
  const [dismissed, setDismissed] = useState(null);
  if (!previousSignIn || dismissed === previousSignIn) return null;
  const { at, ip, failedSignIns } = previousSignIn;
  return (
    <div className="gutter flex-none pt-3">
      <div
        className="kalert kalert-info flex-bc"
        role="status"
        data-locator="previous-sign-in"
      >
        <span>
          Last successful sign-in: {formatTime(at)}
          {ip && <> from {ip}</>}.{' '}
          {failedSignIns === 1
            ? '1 failed attempt since then.'
            : `${failedSignIns} failed attempts since then.`}
        </span>
        <button
          type="button"
          className="kbtn kbtn-ghost kbtn-xs kbtn-circle"
          aria-label="Dismiss"
          onClick={() => setDismissed(previousSignIn)}
        >
          <Icon name="x" />
        </button>
      </div>
    </div>
  );
};

PreviousSignIn.propTypes = {
  /** `{ at, ip, failedSignIns }`, or null. */
  previousSignIn: t.object,
};
