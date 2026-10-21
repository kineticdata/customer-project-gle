import { throttle } from 'lodash-es';
import { regRedux } from '../redux.js';
import { getAttributeValue } from './records.js';
import { calculateThemeState, themeState } from './theme.js';

// State for the customized theme
export const themeActions = regRedux(
  'theme',
  { ...themeState },
  {
    setTheme(state, payload) {
      calculateThemeState(state, getAttributeValue(payload.kapp, 'Theme'));
    },
    enableEditor(state) {
      state.editor = true;
    },
    disableEditor(state) {
      state.editor = false;
    },
  },
);

// State for global app data
export const appActions = regRedux(
  'app',
  {
    // Is the user authenticated
    authenticated: false,
    // Space record
    space: null,
    // Slug of the kapp to use for the service portal
    kappSlug: null,
    // Service portal kapp record
    kapp: null,
    // Profile record
    profile: null,
    // Error from fetching any app data
    error: null,
  },
  {
    setAuthenticated(state, payload) {
      state.authenticated = payload;
    },
    setSpace(state, { error, space }) {
      if (error) state.error = error;
      else {
        // Clear any prior error (e.g. an expected public-fetch 401 while logged out) now
        // that we have a successful space response.
        state.error = null;
        state.space = space;
        state.kappSlug = getAttributeValue(
          space,
          'Service Portal Kapp Slug',
          'service-portal',
        );
      }
    },
    setKapp(state, { error, kapp }) {
      if (error) state.error = state.error || error;
      else state.kapp = kapp;
    },
    setProfile(state, { error, profile }) {
      if (error) state.error = state.error || error;
      else state.profile = profile;
    },
    updateProfile(state, profile) {
      Object.assign(state.profile, profile);
    },
  },
);

// State for the current view size of the app
const viewActions = regRedux(
  'view',
  { ...calcViewState() },
  {
    handleResize(state) {
      calcViewState(state);
    },
  },
);
// Register a resize handler to update the view state
window.addEventListener('resize', throttle(viewActions.handleResize, 200));

/**
 * Function that updates a state object with the latest view data
 * @param {Object} state
 * @returns {Object}
 */
function calcViewState(state = {}) {
  state.width = window.innerWidth;
  if (window.innerWidth < 640) {
    state.size = 'xs'; // 0 <-> 639
  } else if (window.innerWidth < 768) {
    state.size = 'sm'; // 640 <-> 767
  } else if (window.innerWidth < 1024) {
    state.size = 'md'; // 768 <-> 1023
  } else if (window.innerWidth < 1280) {
    state.size = 'lg'; // 1024 <-> 1279
  } else if (window.innerWidth < 1536) {
    state.size = 'xl'; // 1280 <-> 1535
  } else {
    state.size = '2xl'; // 1536 <-> ...
  }
  state.mobile = ['xs', 'sm'].includes(state.size);
  state.tablet = ['md', 'lg'].includes(state.size);
  state.desktop = ['xl', '2xl'].includes(state.size);
  return state;
}
