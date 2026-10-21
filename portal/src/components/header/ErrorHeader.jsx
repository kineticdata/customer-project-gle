import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import logo from '../../assets/images/GLE-Logo.png';
import { HeaderPortal } from './HeaderPortal.jsx';
import { Avatar } from '../../atoms/Avatar.jsx';
import { Menu } from '../../atoms/Menu.jsx';
import { signOut } from '../../helpers/index.js';

export const ErrorHeader = () => {
  // profile is null until a user is authenticated; guard so the error header can render
  // (e.g. on an error screen shown while logged out) without crashing.
  const { username, displayName } = useSelector(state => state.app.profile) || {};

  const themeLogo = useSelector(state => state.theme.data?.logo?.default);

  return (
    <HeaderPortal>
      <nav className="stretch py-3 flex items-center gap-10 bg-base-100">
        <Link to="/" className="flex-none" aria-label="Home">
          <img
            src={themeLogo || logo}
            alt="Logo"
            className="h-6 max-h-12 max-w-80 object-contain"
          />
        </Link>
        <div className="mx-auto" />
        <Menu
          items={[
            displayName && { label: displayName, type: 'group' },
            { label: username, type: 'group' },
            { label: 'Logout', onClick: signOut, icon: 'logout' },
          ].filter(Boolean)}
        >
          <button slot="trigger" className="kbtn kbtn-ghost kbtn-circle">
            <Avatar
              username={username}
              size="xl"
              className="flex-none"
              aria-label="User Menu"
            />
          </button>
        </Menu>
      </nav>
    </HeaderPortal>
  );
};
