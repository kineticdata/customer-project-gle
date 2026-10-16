import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { produce } from 'immer';
import { debounce, isEqualWith } from 'lodash-es';
import { ColorPicker, parseColor } from '@ark-ui/react/color-picker';
import { updateKapp, updateSpace } from '@kineticdata/react';
import { Avatar } from '../../atoms/Avatar.jsx';
import { ChipButton, CloseButton } from '../../atoms/Button.jsx';
import { Icon } from '../../atoms/Icon.jsx';
import { Modal } from '../../atoms/Modal.jsx';
import { PageHeading } from '../../components/PageHeading.jsx';
import { StatusDot, StatusPill } from '../../components/tickets/StatusPill.jsx';
import { themeActions } from '../../helpers/state.js';
import { buildStyleObject, useDefaultTheme } from '../../helpers/theme.js';
import logo from '../../assets/images/GLE-Logo.png';
import { Menu } from '../../atoms/Menu.jsx';
import { Portal } from '@ark-ui/react/portal';
import { Tooltip } from '../../atoms/Tooltip.jsx';

const updateThemeAttribute = async (kappSlug, theme) =>
  updateKapp({
    kappSlug,
    kapp: { attributesMap: { Theme: [JSON.stringify(theme)] } },
    include: 'attributesMap',
  }).then(response => {
    if (!response.error) themeActions.setTheme(response);
    return response;
  });

const useDirtyCheck = (currentTheme, savedTheme) => {
  const isDirty = !isEqualWith(savedTheme, currentTheme, (a, b) => {
    if (a && a?.toLowerCase && b && b?.toLowerCase)
      return a.toLowerCase() === b.toLowerCase();
  });
  const isChanged =
    Object.values(savedTheme?.colors || {}).filter(Boolean).length > 0 ||
    Object.values(savedTheme?.radius || {}).filter(Boolean).length > 0 ||
    Object.values(savedTheme?.logo || {}).filter(Boolean).length > 0;
  return [isDirty, isChanged];
};

const generateColorButtonComponent = ({ changeColor }) =>
  memo(({ name, variant, content, value }) => {
    const fullName = useMemo(
      () =>
        variant ? `${name}-${variant}` : content ? `${name}-content` : name,
      [name, variant, content],
    );

    const [colorValue, setColorValue] = useState(() =>
      parseColor(value || '#ffffff'),
    );

    const onChange = useCallback(
      e => {
        setColorValue(e.value);
        changeColor(fullName, e?.value?.toString('hex') || '');
      },
      [fullName],
    );

    useEffect(() => {
      if (
        (value?.toLowerCase() || '#ffffff') !==
        colorValue?.toString('hex')?.toLowerCase()
      )
        setColorValue(parseColor(value || '#ffffff'));
    }, [value, colorValue]);

    return (
      <ColorPicker.Root
        value={colorValue}
        onValueChange={onChange}
        positioning={{ placement: 'bottom-start' }}
      >
        <ColorPicker.Control className="flex">
          <ColorPicker.Trigger asChild>
            <button
              className={clsx(
                'w-15 h-15 rounded-xl shadow-md shadow-black/10',
                'cursor-pointer hover:shadow-lg hover:shadow-black/20',
                'focus-visible:outline-2 focus-visible:outline-black/60',
                {
                  'font-black text-2xl': content,
                  'font-semibold': variant,
                },
              )}
              style={{
                backgroundColor: `var(--color-${variant ? fullName : typeof content === 'string' ? `${name}-${content}` : name})`,
                color: `var(--color-${content ? fullName : `${name}-content`})`,
              }}
              aria-label={`Change ${name}${variant ? `-${variant}` : content ? ' text' : ''} color`}
              title={`Change ${name}${variant ? `-${variant}` : content ? ' text' : ''} color`}
            >
              {variant || (content && 'A')}
            </button>
          </ColorPicker.Trigger>
        </ColorPicker.Control>
        <Portal>
          <ColorPicker.Positioner>
            <ColorPicker.Content
              tabIndex={-1}
              className="flex flex-col gap-4 p-4 bg-white border border-black/10 rounded-xl min-w-72 shadow-lg z-30"
            >
              <ColorPicker.Area className="w-full h-32">
                <ColorPicker.AreaBackground className="h-32 rounded" />
                <ColorPicker.AreaThumb className="w-3 h-3 rounded-full border-2 border-white shadow-xs shadow-black/50 inset-shadow-xs inset-shadow-black/50" />
              </ColorPicker.Area>
              <ColorPicker.ChannelSlider channel="hue">
                <ColorPicker.ChannelSliderTrack className="w-full h-3 rounded-full" />
                <ColorPicker.ChannelSliderThumb className="w-3 h-3 rounded-full border-2 border-white shadow-xs shadow-black/50 inset-shadow-xs inset-shadow-black/50 -translate-1/2" />
              </ColorPicker.ChannelSlider>
              <ColorPicker.View format="rgba" className={clsx('flex gap-4')}>
                <ColorPicker.ChannelInput
                  channel="hex"
                  className={clsx('shrink !w-1 flex-1 kinput')}
                />
                <ColorPicker.EyeDropperTrigger asChild>
                  <button type="button" className="kbtn kbtn-soft kbtn-circle">
                    <Icon name="color-picker" />
                  </button>
                </ColorPicker.EyeDropperTrigger>
              </ColorPicker.View>
            </ColorPicker.Content>
          </ColorPicker.Positioner>
        </Portal>
      </ColorPicker.Root>
    );
  });

const generateRadiusFieldComponent =
  ({ changeRadius }) =>
  ({ name, description, value }) => {
    return (
      <div className="flex-sc gap-2">
        <button
          type="button"
          className="kbtn kbtn-soft kbtn-circle kbtn-sm"
          onClick={() =>
            changeRadius(
              name,
              `${Math.max((parseFloat(value) || 0) - 0.25, 0)}rem`,
            )
          }
          aria-label={`Decrease ${name} radius`}
          disabled={!value || value === '0rem'}
        >
          <Icon name="minus" />
        </button>
        <div className="relative w-15 h-15 rounded-xl bg-base-200 flex-c-bc p-0.5">
          <div
            className={clsx(
              `flex-1 self-stretch border-t-2 border-r-2 border-black m-2`,
              {
                'rounded-tr-none': !value || value === '0rem',
                'rounded-tr-[0.25rem]': value === '0.25rem',
                'rounded-tr-[0.5rem]': value === '0.5rem',
                'rounded-tr-[0.75rem]': value === '0.75rem',
                'rounded-tr-[1rem]': value === '1rem',
                'rounded-tr-[1.25rem]': value === '1.25rem',
                'rounded-tr-[1.5rem]': value === '1.5rem',
                'rounded-tr-[1.75rem]': value === '1.75rem',
                'rounded-tr-[2rem]': value === '2rem',
              },
            )}
          />
        </div>
        <button
          type="button"
          className="kbtn kbtn-soft kbtn-circle kbtn-sm"
          onClick={() =>
            changeRadius(name, `${(parseFloat(value) || 0) + 0.25}rem`)
          }
          aria-label={`Increase ${name} radius`}
          disabled={value === '2rem'}
        >
          <Icon name="plus" />
        </button>
        <div className="flex-c-st gap-1 ml-2">
          <div className="text-lg font-medium">{name}</div>
          <div className="text-sm italic text-black/60 -mt-1">
            {description}
          </div>
        </div>
      </div>
    );
  };

const LogoFieldComponent = ({ name, value, onChange }) => {
  const [url, setUrl] = useState(value || '');
  const debouncedChange = useMemo(
    () =>
      debounce(value => {
        onChange(name, value);
      }, 1000),
    [onChange, name],
  );
  useEffect(() => {
    setUrl(value || '');
  }, [value]);

  return (
    <div className="field">
      <input
        type="text"
        className="kinput w-full"
        placeholder="Logo URL"
        aria-label="Logo URL Field"
        value={url}
        onChange={e => {
          setUrl(e.target.value);
          debouncedChange(e.target.value);
        }}
        onBlur={() => {
          debouncedChange.cancel();
          onChange(name, url);
        }}
      />
    </div>
  );
};

const ColorWrapper = ({ name, children }) => (
  <div className="flex-c-st gap-1">
    <div className="flex-sc gap-3 sm:gap-8">{children}</div>
    <div className="text-lg font-medium">{name}</div>
  </div>
);

export const Theme = () => {
  const location = useLocation();
  const backPath = location.state?.backPath || './..';
  const desktop = useSelector(state => state.view.desktop);
  const profile = useSelector(state => state.app.profile);
  const portalRef = useRef(null);
  const kapp = useSelector(state => state.app.kapp);
  const missingThemeAttributeDefinition = !kapp?.attributesMap?.['Theme'];

  // Get the default theme by extracting it from the dom
  const [defaultThemeRef, defaultTheme] = useDefaultTheme();
  // Get the saved theme from state
  const savedTheme = useSelector(state => state.theme.data || {});
  // Create state for the current theme
  const [currentTheme, setCurrentTheme] = useState(savedTheme || {});

  // Function for determining the color value for a variable
  const colorValue = name =>
    currentTheme.colors?.[name] ||
    savedTheme.colors?.[name] ||
    defaultTheme?.colors?.[name];
  // Change handler for color changes
  const changeColor = useCallback((name, value) => {
    setCurrentTheme(theme =>
      produce(theme, draft => {
        if (!draft.colors) draft.colors = {};
        draft.colors[name] = value;
      }),
    );
  }, []);

  // Function for determining the radius value for a variable
  const radiusValue = name =>
    currentTheme.radius?.[name] ||
    savedTheme.radius?.[name] ||
    defaultTheme?.radius?.[name];
  // Change handler for radius changes
  const changeRadius = useCallback((name, value) => {
    setCurrentTheme(theme =>
      produce(theme, draft => {
        if (!draft.radius) draft.radius = {};
        draft.radius[name] = value;
      }),
    );
  }, []);

  // Function for determining the logo value for a variable
  const logoValue = name =>
    currentTheme.logo?.[name] || savedTheme.logo?.[name];
  // Change handler for logo changes
  const changeLogo = useCallback((name, value) => {
    setCurrentTheme(theme =>
      produce(theme, draft => {
        if (!draft.logo) draft.logo = {};
        draft.logo[name] = value;
      }),
    );
  }, []);

  // Handler for resetting local changes
  const resetChanges = useCallback(
    () => setCurrentTheme(savedTheme),
    [savedTheme],
  );

  // Handler for saving the changed
  const [saveState, setSaveState] = useState('idle');
  const saveChanges = useCallback(() => {
    setSaveState('pending');
    updateThemeAttribute(kapp.slug, currentTheme).then(({ error }) => {
      if (error) {
        console.log('Error saving theme:', error);
        setSaveState('error');
        return;
      }
      setSaveState('success');
      setTimeout(
        () => setSaveState(status => (status === 'success' ? 'idle' : status)),
        4000,
      );
    });
  }, [currentTheme, kapp]);
  // Handler for resetting the saved theme
  const [resetState, setResetState] = useState('idle');
  const resetTheme = useCallback(() => {
    setResetState('pending');
    updateThemeAttribute(kapp.slug, {}).then(({ error }) => {
      if (error) {
        console.log('Error resetting theme:', error);
        setResetState('error');
        return;
      }
      setResetState('success');
      setCurrentTheme({});
      setTimeout(
        () => setResetState(status => (status === 'success' ? 'idle' : status)),
        4000,
      );
    });
  }, []);

  // Check if the theme is dirty, and if there are any changes from the default
  const [isDirty, isChanged] = useDirtyCheck(currentTheme, savedTheme);

  const ColorButton = useMemo(
    () => generateColorButtonComponent({ changeColor }),
    [changeColor],
  );
  const RadiusField = useMemo(
    () => generateRadiusFieldComponent({ changeRadius }),
    [changeRadius],
  );

  // Build a styles object from the current theme to use for the preview
  const currentStyles = buildStyleObject(currentTheme);

  return (
    <div
      className="flex-st flex-auto h-full overflow-hidden"
      data-theme-editor
      ref={defaultThemeRef}
    >
      {/* Sidebar ************************************************************/}
      <div className="flex-c-st gap-10 p-10 overflow-auto w-full xl:w-108 min-h-full bg-base-100 text-base-content">
        {defaultTheme && (
          <>
            <div className="flex-sc gap-3">
              <Link
                className="kbtn kbtn-ghost kbtn-circle kbtn-lg"
                to={backPath}
                aria-label="Back"
              >
                <Icon name="arrow-left" />
              </Link>
              <div>
                <h1 className="text-2xl">Theme Editor</h1>
                <h2 className="text-base">{kapp?.name}</h2>
              </div>
              {isChanged && (
                <Menu
                  alignment="end"
                  items={[{ label: 'Reset Custom Theme', onClick: resetTheme }]}
                >
                  <button
                    slot="trigger"
                    type="button"
                    className="ml-auto kbtn kbtn-ghost kbtn-circle kbtn-lg"
                    aria-label="More Options"
                  >
                    <Icon name="dots-vertical" />
                  </button>
                </Menu>
              )}
            </div>
            {missingThemeAttributeDefinition && (
              <div className="kalert kalert-error flex-ss gap-3">
                <Icon name="alert-square-rounded" className="flex-none" />
                <span>
                  You must create a &#34;Theme&#34; kapp attribute definition in
                  the {kapp.name} kapp in order to save a custom theme.
                </span>
              </div>
            )}

            {!desktop && (
              <div className="kalert kalert-info flex-ss gap-3">
                <Icon name="info-square-rounded" className="flex-none" />
                <span>
                  Use a larger screen to preview the theme on this page.
                </span>
              </div>
            )}

            {resetState === 'pending' && (
              <div className="kalert kalert-info">
                <Icon
                  name="loader-2"
                  size={20}
                  className="inline animate-spin"
                />{' '}
                Resetting theme...
              </div>
            )}
            {resetState === 'success' && (
              <div className="kalert kalert-success">
                <Icon name="check" size={20} className="inline" /> The theme was
                reset successfully.
              </div>
            )}
            {resetState === 'error' && (
              <div className="kalert kalert-error">
                <Icon name="alert-triangle" size={20} className="inline" />{' '}
                There was an error resetting the theme.
              </div>
            )}

            <h2 className="flex-sc gap-3 text-xl">
              <Icon name="palette" />
              <span>Change Colors</span>
            </h2>

            <div className="flex-c-st gap-10" style={currentStyles}>
              <div className="flex-ss gap-3 sm:gap-8">
                <ColorWrapper name="base">
                  <ColorButton
                    name="base"
                    variant="100"
                    value={colorValue('base-100')}
                  />
                  <ColorButton
                    name="base"
                    variant="200"
                    value={colorValue('base-200')}
                  />
                  <ColorButton
                    name="base"
                    variant="300"
                    value={colorValue('base-300')}
                  />
                  <ColorButton
                    name="base"
                    content="100"
                    value={colorValue('base-content')}
                  />
                </ColorWrapper>
              </div>
              <div className="flex-ss gap-3 sm:gap-8">
                <ColorWrapper name="primary">
                  <ColorButton name="primary" value={colorValue('primary')} />
                  <ColorButton
                    name="primary"
                    content
                    value={colorValue('primary-content')}
                  />
                </ColorWrapper>
                <ColorWrapper name="secondary">
                  <ColorButton
                    name="secondary"
                    value={colorValue('secondary')}
                  />
                  <ColorButton
                    name="secondary"
                    content
                    value={colorValue('secondary-content')}
                  />
                </ColorWrapper>
              </div>
              <div className="flex-ss gap-3 sm:gap-8">
                <ColorWrapper name="neutral">
                  <ColorButton name="neutral" value={colorValue('neutral')} />
                  <ColorButton
                    name="neutral"
                    content
                    value={colorValue('neutral-content')}
                  />
                </ColorWrapper>
                <ColorWrapper name="accent">
                  <ColorButton name="accent" value={colorValue('accent')} />
                  <ColorButton
                    name="accent"
                    content
                    value={colorValue('accent-content')}
                  />
                </ColorWrapper>
              </div>
              <div className="flex-ss gap-3 sm:gap-8">
                <ColorWrapper name="info">
                  <ColorButton name="info" value={colorValue('info')} />
                  <ColorButton
                    name="info"
                    content
                    value={colorValue('info-content')}
                  />
                </ColorWrapper>
                <ColorWrapper name="success">
                  <ColorButton name="success" value={colorValue('success')} />
                  <ColorButton
                    name="success"
                    content
                    value={colorValue('success-content')}
                  />
                </ColorWrapper>
              </div>
              <div className="flex-ss gap-3 sm:gap-8">
                <ColorWrapper name="warning">
                  <ColorButton name="warning" value={colorValue('warning')} />
                  <ColorButton
                    name="warning"
                    content
                    value={colorValue('warning-content')}
                  />
                </ColorWrapper>
                <ColorWrapper name="error">
                  <ColorButton name="error" value={colorValue('error')} />
                  <ColorButton
                    name="error"
                    content
                    value={colorValue('error-content')}
                  />
                </ColorWrapper>
              </div>
            </div>

            <h2 className="flex-sc gap-3 text-xl mt-4">
              <Icon name="border-radius" />
              <span>Change Radius</span>
            </h2>

            <RadiusField
              name="box"
              description="cards, modals, etc."
              value={radiusValue('box')}
            />
            <RadiusField
              name="field"
              description="buttons, fields, etc."
              value={radiusValue('field')}
            />
            <RadiusField
              name="selector"
              description="checkboxes, badges, etc."
              value={radiusValue('selector')}
            />

            <h2 className="flex-sc gap-3 text-xl mt-4">
              <Icon name="photo-square-rounded" />
              <span>Change Logo</span>
              <Tooltip
                content="Upload a logo image to an external store such as S3 or Google Drive and enter the URL here to use it in the theme."
                position="top"
                alignment="middle"
              >
                <Icon
                  slot="trigger"
                  className="text-base-content/50 hover:text-base-content/70 ml-auto"
                  name="info-square-rounded"
                  filled
                />
              </Tooltip>
            </h2>

            <LogoFieldComponent
              name="default"
              value={logoValue('default')}
              onChange={changeLogo}
            />

            {!missingThemeAttributeDefinition && (
              <div className="flex-c-st gap-3">
                {saveState === 'pending' && (
                  <div className="kalert kalert-info">
                    <Icon
                      name="loader-2"
                      size={20}
                      className="inline animate-spin"
                    />{' '}
                    Saving theme...
                  </div>
                )}
                {saveState === 'success' && (
                  <div className="kalert kalert-success">
                    <Icon name="check" size={20} className="inline" /> The theme
                    was saved successfully.
                  </div>
                )}
                {saveState === 'error' && (
                  <div className="kalert kalert-error">
                    <Icon name="alert-triangle" size={20} className="inline" />{' '}
                    There was an error saving the theme.
                  </div>
                )}
                <button
                  type="button"
                  className="kbtn kbtn-soft kbtn-lg"
                  disabled={
                    !isDirty ||
                    saveState === 'pending' ||
                    resetState === 'pending'
                  }
                  onClick={saveChanges}
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  className="kbtn kbtn-ghost kbtn-lg"
                  disabled={
                    !isDirty ||
                    saveState === 'pending' ||
                    resetState === 'pending'
                  }
                  onClick={resetChanges}
                >
                  Reset
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Preview ************************************************************/}
      {desktop && (
        <div
          className="flex-c-st flex-1 h-full shadow-xl shadow-black/30 overflow-auto bg-base-100 text-base-content"
          style={currentStyles}
          ref={portalRef}
        >
          {/* Full width previews */}
          <PreviewHeader
            profile={profile}
            logo={currentTheme?.logo?.default || logo}
          />
          <PreviewHero profile={profile} />

          {/* Preview columns */}
          <div className="flex-c-st 2xl:flex-row gap-10 p-10">
            <div className="flex-c-st gap-10 flex-2/5 max-w-screen-sm">
              <PreviewCategories />
              <PreviewActivityHome />
              <PreviewToast />
              <PreviewFilter />
              <PreviewAlert />
            </div>
            <div className="flex-c-st gap-10 flex-3/5">
              <PreviewPageHeading portalRef={portalRef} />
              <PreviewActivityList />
              <PreviewRequestDetail />
              <PreviewForm />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PreviewHeader = ({ profile, logo }) => (
  <header className="relative flex-sc gap-3 h-20 bg-base-100 z-20 py-2 px-3">
    <button className="kbtn kbtn-ghost kbtn-square kbtn-lg">
      <Icon name="menu-2" size={20} />
    </button>
    <span className="flex-initial">
      <img src={logo} alt="Logo" className="logo" />
    </span>
    <div className="mx-auto" />
    <button className="kbtn kbtn-ghost kbtn-square kbtn-lg">
      <Icon name="search" size={20} />
    </button>
    <Avatar username={profile?.username} size="lg" className="flex-none" />
  </header>
);

const PreviewHero = ({ profile }) => (
  <div className="flex-c-st gap-8 bg-base-200 py-10 px-15">
    <div className="text-5xl font-semibold">Hello, {profile.displayName}</div>
    <div className="flex-ss gap-8 max-w-screen-lg">
      <button type="button" className="kbtn kbtn-primary kbtn-xl flex-1">
        Submit a Request
      </button>
      <button
        type="button"
        className="kbtn kbtn-outline kbtn-base kbtn-xl flex-1"
      >
        Check Status
      </button>
      <button
        type="button"
        className="kbtn kbtn-outline kbtn-base kbtn-xl flex-1"
      >
        See My Work
      </button>
    </div>
  </div>
);

const PreviewActivityHome = () => (
  <div className="kcard">
    <div className="kcard-body">
      <ul className="klist text-base">
        {[
          ['device-laptop', 'Hardware Request - Laptop', 'Draft'],
          ['robot', 'Software Request - AI Agent Access', 'Open'],
          ['circle-dashed-check', 'Approval for New Employee Access', 'Closed'],
        ].map(([icon, label, status], i) => (
          <li className="klist-row min-h-20 hover:bg-base-200" key={i}>
            <div className="icon-box -my-3">
              <Icon name={icon} />
            </div>
            <span className="line-clamp-2 after:absolute after:inset-0">
              {label}
            </span>
            <StatusPill status={status} />
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const PreviewPageHeading = ({ portalRef }) => (
  <PageHeading
    title="Page Heading"
    backTo="./"
    after={<span className="kbadge kbadge-neutral">Badge</span>}
    className="!mb-0"
  >
    <Modal title="Sample Modal" size="sm" portal={portalRef}>
      <button slot="trigger" type="button" className="kbtn kbtn-lg ml-auto">
        Modal
      </button>
      <div slot="body">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
        veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
        commodo consequat.
      </div>
      <div slot="footer">
        <button type="button" className="kbtn kbtn-lg kbtn-primary w-full">
          Action Button
        </button>
      </div>
    </Modal>
  </PageHeading>
);

const PreviewActivityList = () => (
  <div className="flex-c-st gap-4 md:grid md:grid-cols-[auto_2fr_1fr_auto]">
    {[
      [
        'device-laptop',
        'Hardware Request - Laptop',
        'Created 2 weeks ago',
        'Draft',
      ],
      [
        'circle-dashed-check',
        'Approval for New Employee Access',
        'Closed 1 month ago',
        'Closed',
      ],
    ].map(([icon, label, date, status], i) => (
      <div
        className={clsx(
          'group relative col-start-1 col-end-5 grid grid-cols-subgrid',
          'gap-3 items-center py-2.75 px-6 min-h-16 rounded-box',
          'bg-base-100 border hover:bg-base-200 focus-within:bg-base-200',
        )}
        key={i}
      >
        <div className="icon-box -my-3">
          <Icon name={icon} />
        </div>
        <span className="line-clamp-2 after:absolute after:inset-0">
          {label}
        </span>
        <div className="text-base-content/60">{date}</div>
        <StatusPill status={status} />
      </div>
    ))}
    <div
      className={clsx(
        'col-start-1 col-end-5 flex-cc gap-6 items-center',
        'py-1.75 px-6 min-h-16 border rounded-box bg-base-100',
      )}
    >
      <button
        type="button"
        className="kbtn kbtn-ghost kbtn-lg kbtn-circle"
        aria-label="Previous Page"
        disabled={true}
      >
        <Icon name="chevrons-left" />
      </button>
      <div className="font-semibold">Page 1</div>
      <button
        type="button"
        className="kbtn kbtn-ghost kbtn-lg kbtn-circle"
        aria-label="Next Page"
      >
        <Icon name="chevrons-right" />
      </button>
    </div>
  </div>
);

const PreviewToast = () => (
  <div className="flex-c-st gap-5">
    {[
      ['success', 'Your action was successful!'],
      ['error', 'An error occurred.', 'You action failed to complete.'],
    ].map(([type, title, description], i) => (
      <div
        className={clsx(
          'flex-c-st gap-3 pl-5 pr-1.5 py-3',
          'rounded-box shadow-lg overflow-hidden',
          {
            'bg-success text-success-content': type !== 'error',
            'bg-error text-error-content': type === 'error',
          },
        )}
        key={i}
      >
        <div className="flex-sc gap-3">
          <Icon
            name={clsx({
              'circle-check-filled': type !== 'error',
              'exclamation-circle-filled': type === 'error',
            })}
            className="flex-none"
          />
          <span className="flex-auto font-medium">{title}</span>
          <CloseButton size="sm" className="flex-none ml-auto -my-1.5" />
        </div>
        {description && (
          <div className="whitespace-pre-wrap">{description}</div>
        )}
      </div>
    ))}
  </div>
);

const PreviewFilter = () => {
  const [[open, closed], setState] = useState([true, false]);
  const none = !open && !closed;
  return (
    <div className="relative p-6 bg-base-100 rounded-box shadow-2xl w-full flex-c-st gap-6">
      <div className="flex-bc gap-3">
        <span className="h3">Filter</span>
        <button className="kbtn kbtn-sm kbtn-circle kbtn-ghost absolute right-2 top-2">
          <Icon name="x" size={20} />
        </button>
      </div>
      <div className="px-4 pt-1 pb-3 flex-c-st gap-4 border-b border-base-300">
        <div className="flex gap-5 flex-wrap">
          <ChipButton
            active={none}
            icon={none ? 'check' : null}
            onClick={() => setState([false, false])}
          >
            All Requests
          </ChipButton>
        </div>
      </div>
      <div className="px-4 pt-1 pb-3 flex-c-st gap-4 border-b border-base-300">
        <span className="font-medium">Status</span>
        <div className="flex gap-5 flex-wrap">
          <ChipButton
            active={open}
            icon={open ? 'check' : null}
            onClick={() => setState(s => [!s[0], s[1]])}
          >
            Open
          </ChipButton>
          <ChipButton
            active={closed}
            icon={closed ? 'check' : null}
            onClick={() => setState(s => [s[0], !s[1]])}
          >
            Closed
          </ChipButton>
        </div>
      </div>
      <button type="button" className="kbtn kbtn-primary mt-auto">
        Show Results
      </button>
    </div>
  );
};

const PreviewRequestDetail = () => (
  <div className="flex-c-st gap-7 py-3">
    <div className="relative flex-c-st bg-base-100 border rounded-box p-7 ml-20 gap-5">
      <div className="absolute w-1 bg-success -left-[3.875rem] top-1/2 h-[calc(50%+1.875rem)]" />
      <div
        className={clsx(
          'absolute flex justify-center items-center border border-base-300',
          'top-1/2 -translate-y-1/2 -left-20 w-10 h-10 rounded-[10px]',
          'bg-success text-success-content',
        )}
      >
        {<Icon name={'robot'} size={24} />}
        <Icon
          name="circle-check"
          className="absolute -right-1 -bottom-1"
          size={16}
          filled
        />
      </div>
      <div className="flex-sc gap-3">
        <div className="flex-auto flex-c-st gap-2.5">
          <div className="text-sm text-base-content/60">1 week ago</div>
          <div className="font-medium">Approval for Request</div>
        </div>
        <div className="flex-none flex-sc gap-2 font-light">
          Approved
          <StatusDot status={'Success'} />
        </div>
      </div>
      <div className="bg-base-200 rounded-box px-2 py-3">
        <dl
          className="max-md:text-xs flex flex-wrap gap-3 md:gap-x-12"
          style={{ overflowWrap: 'anywhere' }}
        >
          <div className="flex flex-col gap-0.5 md:gap-1">
            <dt className="text-base-content/60 font-medium">Assigned Team</dt>
            <dd>Management</dd>
          </div>
          <div className="flex flex-col gap-0.5 md:gap-1">
            <dt className="text-base-content/60 font-medium">Comment</dt>
            <dd>This request should be expedited.</dd>
          </div>
        </dl>
      </div>
    </div>
    <div className="relative flex-c-st bg-base-100 border rounded-box p-7 ml-20 gap-5">
      <div className="absolute w-1 bg-success -left-[3.875rem] top-0 h-1/2" />
      <div
        className={clsx(
          'absolute flex justify-center items-center border border-base-300',
          'top-1/2 -translate-y-1/2 -left-20 w-10 h-10 rounded-[10px]',
          'bg-base-100 text-base-content',
        )}
      >
        {<Icon name={'robot'} size={24} />}
      </div>
      <div className="flex-sc gap-3">
        <div className="flex-auto flex-c-st gap-2.5">
          <div className="text-sm text-base-content/60">3 days ago</div>
          <div className="font-medium">Pending Fulfillment</div>
        </div>
      </div>
    </div>
  </div>
);

const PreviewForm = () => (
  <form className="rounded-box border p-8 flex-c-st gap-6">
    <div className="field required">
      <label htmlFor="preview-text-field">Email Address</label>
      <input
        type="text"
        id="preview-text-field"
        placeholder="user@kineticdata.com"
      />
      <span className="flex-sc gap-2 text-base-content/80 mt-1 text-sm">
        <span className="kstatus kstatus-info"></span>
        Do not use your personal email address.
      </span>
    </div>
    <div className="flex-ss gap-5">
      <div className="field flex-1">
        <label htmlFor="preview-text-field2">Name</label>
        <input
          type="text"
          id="preview-text-field2"
          disabled
          defaultValue="John User"
        />
      </div>
      <div className="field flex-1">
        <label htmlFor="preview-select-field">Team</label>
        <select id="preview-select-field" defaultValue="Management">
          <option value=""></option>
          <option value="Management">Management</option>
          <option value="Engineering">Engineering</option>
          <option value="Success">Success</option>
        </select>
      </div>
    </div>
    <div className="flex-ss gap-5">
      <div className="field flex-1 has-error">
        <label htmlFor="preview-date-field">Due Date</label>
        <input type="datetime-local" id="preview-date-field" />
        <span className="flex-sc gap-2 text-base-content/80 mt-1 text-sm">
          <span className="kstatus kstatus-error"></span>
          Due date is invalid.
        </span>
      </div>
      <div className="field flex-1 flex-sc gap-x-4 flex-wrap">
        <label className="flex-full">Priority</label>
        <label
          className="flex-sc gap-2 w-auto flex-none"
          htmlFor="preview-radio-field-low"
        >
          <input
            type="radio"
            id="preview-radio-field-low"
            name="preview-radio-field"
            defaultChecked
          />
          Low
        </label>
        <label
          className="flex-sc gap-2 w-auto flex-none"
          htmlFor="preview-radio-field-medium"
        >
          <input
            type="radio"
            id="preview-radio-field-medium"
            name="preview-radio-field"
          />
          Medium
        </label>
        <label
          className="flex-sc gap-2 w-auto flex-none"
          htmlFor="preview-radio-field-high"
        >
          <input
            type="radio"
            id="preview-radio-field-high"
            name="preview-radio-field"
          />
          High
        </label>
      </div>
    </div>
    <div className="flex-bs gap-5">
      <div className="field">
        <label
          className="flex-sc gap-2 w-auto flex-none"
          htmlFor="preview-checkbox-field"
        >
          <input type="checkbox" id="preview-checkbox-field" defaultChecked />I
          agree to the Terms and Conditions
        </label>
      </div>
      <div className="flex-sc gap-3">
        <button type="button" className="kbtn kbtn-outline kbtn-lg">
          Save
        </button>
        <button type="button" className="kbtn kbtn-primary kbtn-lg">
          Submit
        </button>
      </div>
    </div>
  </form>
);

const PreviewCategories = () => (
  <div className="flex-bs">
    {[
      ['users', 'Employee Services'],
      ['pig-money', 'Financial Services'],
      ['folders', 'General Services'],
      ['gavel', 'Legal Services'],
    ].map(([icon, name], i) => (
      <div className="group relative w-1/4 px-2 flex-c-sc gap-4" key={i}>
        <div className="icon-box-lg group-hover:bg-base-300">
          <Icon name={icon} />
        </div>
        <button
          type="button"
          className="cursor-pointer after:absolute after:inset-y-0 after:inset-x-2"
        >
          {name}
        </button>
      </div>
    ))}
  </div>
);

const PreviewAlert = () => (
  <div className="flex-c-st gap-5">
    <div role="alert" className="kalert kalert-info">
      <Icon name="info-square-rounded" filled />
      <span>Attention! Thank you for noticing.</span>
    </div>
    <div role="alert" className="kalert kalert-warning">
      <Icon name="alert-hexagon" filled />
      <span>Warning! You have been warned.</span>
    </div>
  </div>
);
