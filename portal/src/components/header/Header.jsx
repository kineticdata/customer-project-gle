import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import logo from '../../assets/images/GLE-Logo.png';
import { Icon } from '../../atoms/Icon.jsx';
import { HeaderPortal } from './HeaderPortal.jsx';
import { Avatar } from '../../atoms/Avatar.jsx';
import { Popover, usePopover } from '@ark-ui/react/popover';
import clsx from 'clsx';
import { openSearch } from '../../helpers/search.js';

export const Header = () => {
  const profile = useSelector(state => state.app.profile);
  const themeLogo = useSelector(state => state.theme.data?.logo?.default);

  return (
    <HeaderPortal>
      <nav className="relative flex-sc gap-3 md:gap-5 h-20 px-3 md:px-6 py-2 bg-base-100 z-20">
        <HeaderMenu profile={profile} />
        <Link to="/" className="flex-initial" aria-label="Home">
          <img src={themeLogo || logo} alt="Logo" className="logo" />
        </Link>
        <div className="mx-auto" />
        <button
          className="kbtn kbtn-ghost kbtn-square kbtn-lg"
          onClick={() => openSearch({ searchOnly: true })}
        >
          <Icon name="search" size={20} />
        </button>
        <Avatar
          username={profile?.username}
          size="lg"
          className="flex-none"
          as="link"
          to="/profile"
        />
      </nav>
    </HeaderPortal>
  );
};

const getMenuItems = profile =>
  [
    {
      items: [
        { label: 'Home', to: '/' },
        { label: 'Submit a Request', onClick: () => openSearch() },
        { label: 'Check Status', to: '/requests' },
        { label: 'My Work', to: '/actions' },
      ],
    },
    profile?.spaceAdmin && {
      title: 'Admin',
      items: [
        { label: 'Theme Editor', to: '/theme' },
        {
          label: 'Platform Console',
          href: '/app/console',
          endIcon: 'external-link',
        },
        {
          label: 'API Documentation',
          href: '/app/docs',
          endIcon: 'external-link',
        },
      ],
    },
  ].filter(Boolean);

const HeaderMenu = ({ profile }) => {
  const popover = usePopover();
  const close = () => popover.setOpen(false);

  const menuItems = getMenuItems(profile);

  return (
    <Popover.RootProvider value={popover} autoFocus={false}>
      <Popover.Trigger asChild>
        <button className="kbtn kbtn-ghost kbtn-square kbtn-lg">
          <Icon name="menu-2" size={20} />
        </button>
      </Popover.Trigger>
      {popover.open && (
        // Custom backdrop for the menu
        <div
          data-scope="menu"
          data-part="dialog"
          data-state="open"
          aria-hidden="true"
          className="fixed inset-0 top-20 bg-black/20"
        />
      )}
      <Popover.Positioner
        className={clsx('!fixed !inset-0 !top-20 w-80', {
          'pointer-events-none': !popover.open,
        })}
        style={{ transform: 'none' }}
      >
        <Popover.Content className="flex-c-st h-full w-full gap-3 px-6 py-4 outline-0 bg-base-100 z-30">
          <ul className="kmenu flex-nowrap gap-3 p-0 w-full flex-auto overflow-auto">
            {menuItems.map((item, i) => (
              <Fragment key={i}>
                {i !== 0 && <hr />}
                <HeaderMenuItem {...item} close={close} />
              </Fragment>
            ))}
          </ul>
          <ul className="kmenu p-0 w-full gap-3 flex-none">
            <hr />
            <HeaderMenuItem
              label="Settings"
              to="/settings"
              icon="settings"
              close={close}
            />
            {/*<HeaderMenuItem*/}
            {/*  label="Help"*/}
            {/*  to="/help"*/}
            {/*  icon="help-square-rounded"*/}
            {/*  close={close}*/}
            {/*/>*/}
          </ul>
        </Popover.Content>
      </Popover.Positioner>
    </Popover.RootProvider>
  );
};

const HeaderMenuItem = ({
  label,
  to,
  href,
  onClick,
  icon,
  endIcon,
  title,
  items,
  close,
}) => {
  if (items) {
    if (title) {
      return (
        <li>
          <details>
            <summary className="content-center h-8 text-xs uppercase">
              {title}
            </summary>
            <ul>
              {items.map((item, i) => (
                <HeaderMenuItem key={i} {...item} close={close} />
              ))}
            </ul>
          </details>
        </li>
      );
    }
    return items.map((item, i) => (
      <HeaderMenuItem key={i} {...item} close={close} />
    ));
  }
  return (
    <li>
      {typeof onClick === 'function' ? (
        <button
          className="content-cemter h12 text-base"
          onClick={() => {
            onClick();
            close();
          }}
        >
          {icon && <Icon name={icon} />}
          <span>{label || to}</span>
          {endIcon && <Icon name={endIcon} size={20} className="ml-auto" />}
        </button>
      ) : href ? (
        <a
          className="content-center h-12 text-base"
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          {icon && <Icon name={icon} />}
          <span>{label || to}</span>
          {endIcon && <Icon name={endIcon} size={20} className="ml-auto" />}
        </a>
      ) : (
        <Link to={to} className="content-center h-12 text-base" onClick={close}>
          {icon && <Icon name={icon} />}
          <span>{label || to}</span>
          {endIcon && <Icon name={endIcon} size={20} className="ml-auto" />}
        </Link>
      )}
    </li>
  );
};
