import { useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import t from 'prop-types';
import clsx from 'clsx';
import { fetchKapp, fetchProfile, fetchSpace } from '@kineticdata/react';
import { Toaster } from './atoms/Toaster.jsx';
import { Loading } from './components/states/Loading.jsx';
import { Error } from './components/states/Error.jsx';
import { closeConfirm } from './helpers/confirm.js';
import { appActions, themeActions } from './helpers/state.js';
import { clearToasts } from './helpers/toasts.js';
import useRouteChange from './helpers/hooks/useRouteChange.js';
import { PrivateRoutes } from './pages/PrivateRoutes.jsx';
import { PublicRoutes } from './pages/PublicRoutes.jsx';
import { Login } from './pages/login/Login.jsx';
import { ConfirmationModal } from './components/confirm/ConfirmationModal.jsx';
import { useData } from './helpers/hooks/useData.js';
import { EnvironmentBanners } from './components/banners/EnvironmentBanners.jsx';
import { PreviousSignIn } from './components/banners/PreviousSignIn.jsx';

export const App = ({
  initialized,
  loggedIn,
  loginProps,
  previousSignIn,
  timedOut,
  serverError,
}) => {
  // Get redux theme state
  const { css: themeCSS } = useSelector(state => state.theme);
  // Update the styles if there is a theme set
  useEffect(() => {
    if (themeCSS) {
      // If themeCSS exists, create a stylesheet and set themeCSS as the content
      const cssSheet = new CSSStyleSheet();
      cssSheet.replace(themeCSS);
      // Set this new constructed stylesheet to be used by the page
      document.adoptedStyleSheets = [cssSheet];
    }
  }, [themeCSS]);

  // Get redux app state
  const { authenticated, kappSlug, error, space, kapp, profile } = useSelector(
    state => state.app,
  );

  // Set an `authenticated` flag in global state that is synced to the loggedIn
  // prop, and can be used in the app to determine if the user is authenticated
  useEffect(() => {
    if (authenticated !== loggedIn) {
      appActions.setAuthenticated(loggedIn);
    }
  }, [authenticated, loggedIn]);

  // Fetch space data. We'll assume that the space record is available publicly
  // so we can get the config data stored in space attributes
  const spaceParams = useMemo(
    () =>
      initialized
        ? loggedIn
          ? { include: 'attributesMap,kapps' }
          : { public: true, include: 'attributesMap,kapps' }
        : null,
    [initialized, loggedIn],
  );
  const {
    initialized: spaceInit,
    loading: spaceLoading,
    response: spaceData,
  } = useData(fetchSpace, spaceParams);
  // Set the space data into redux
  useEffect(() => {
    if (spaceInit && !spaceLoading) {
      // When logged out, the space is fetched publicly and returns 401 for spaces without
      // an anonymous-access form. That 401 is expected and must not block the login screen,
      // so we ignore it. Any other failure (e.g. a 500) - or any failure once logged in - is
      // recorded normally so genuine errors still surface as an error screen.
      const isExpectedPublic401 =
        !loggedIn && spaceData?.error?.statusCode === 401;
      if (!isExpectedPublic401) {
        appActions.setSpace(spaceData);
      }
    }
  }, [spaceInit, spaceLoading, spaceData, loggedIn]);

  // Fetch profile data once the user is logged in
  const profileParams = useMemo(
    () =>
      initialized && loggedIn
        ? { include: 'profileAttributesMap,attributesMap,memberships' }
        : null,
    [initialized, loggedIn],
  );
  const {
    initialized: profileInit,
    loading: profileLoading,
    response: profileData,
  } = useData(fetchProfile, profileParams);
  // Set the profile data into redux
  useEffect(() => {
    if (profileInit && !profileLoading) {
      appActions.setProfile(profileData);
    }
  }, [profileInit, profileLoading, profileData]);

  // Fetch kapp data once the user is logged in and a kapp slug is set, which
  // happens after the space is retrieved
  const kappParams = useMemo(
    () =>
      initialized && loggedIn && kappSlug
        ? {
            kappSlug,
            include: 'attributesMap,categories,categories.attributesMap',
          }
        : null,
    [initialized, loggedIn, kappSlug],
  );
  const {
    initialized: kappInit,
    loading: kappLoading,
    response: kappData,
  } = useData(fetchKapp, kappParams);
  // Set the kapp data into redux
  useEffect(() => {
    if (kappInit && !kappLoading) {
      appActions.setKapp(kappData);
      themeActions.setTheme(kappData);
    }
  }, [kappInit, kappLoading, kappData]);

  // Clear toasts and confirmation modals whenever we change routes
  useRouteChange((pathname, state) => {
    if (!state?.persistToasts) {
      clearToasts();
    }
    closeConfirm();
  }, []);

  return (
    <>
      <div className="flex-c-st flex-auto overflow-auto">
        {/* The space's environment banner, above the header area */}
        <EnvironmentBanners />

        {/* Header element where we will render headers via a portal */}
        <header id="app-header" className="flex-none" />

        {/* After a username and password sign in, when the space shows it */}
        {loggedIn && <PreviousSignIn previousSignIn={previousSignIn} />}

        <main
          id="app-main"
          className={clsx(
            'flex-auto relative overflow-y-auto overflow-x-hidden scrollbar',
          )}
        >
          {!initialized ? (
            // Wait for authentication to initialize before deciding what to render
            <Loading />
          ) : serverError || error ? (
            // A genuine error occurred during auth or while loading app data, show an
            // error screen. An expected public-space 401 while logged out is filtered out
            // before it reaches redux (see the setSpace effect above), so it never lands
            // here and therefore does not block the login screen; a 500 or other failure
            // still does.
            <Error error={serverError || error} header={true} />
          ) : !loggedIn ? (
            // If the user is not logged in, render the public routes, which will default
            // to rendering the login page for all unmatched routes. This does not depend
            // on the space fetch.
            <PublicRoutes loginProps={loginProps} />
          ) : !space ? (
            // Logged in and waiting on the space record, show a loading screen
            <Loading />
          ) : kapp && profile ? (
            // If the user is logged in and kapp and profile data has been
            // fetched, render the private routes, and render the Login
            // component in a modal if auth times out
            <>
              <PrivateRoutes />
              {timedOut && (
                <dialog open>
                  {/* The dialog covers the page, so it shows the banner itself */}
                  <EnvironmentBanners />
                  <Login {...loginProps} />
                </dialog>
              )}
            </>
          ) : (
            <Loading />
          )}

          {/* Toast container */}
          <Toaster />
        </main>

        {/* Footer element where we will render footers via a portal */}
        <footer id="app-footer" />

        {/* The space's environment banner, below the footer area (only when the space places
            it at the top and bottom) */}
        <EnvironmentBanners placement="bottom" />
      </div>

      {/* Panels element where we will render panels via a portal */}
      <div id="app-panels" />

      {/* Global confirmation modal */}
      <ConfirmationModal />
    </>
  );
};

App.propTypes = {
  initialized: t.bool,
  loggedIn: t.bool,
  loginProps: t.object,
  previousSignIn: t.object,
  timedOut: t.bool,
  serverError: t.object,
};
