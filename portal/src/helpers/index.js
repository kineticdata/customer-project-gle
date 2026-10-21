import { formatDistance } from 'date-fns';
import { logout } from '@kineticdata/react';

/******************************************************************************
 * General helper functions
 ******************************************************************************/

/**
 * Wraps a parameter in an array if it isn't already an array.
 *
 * @param {*|Array} maybeArray The parameter to wrap in an array if it isn't
 *  already an array.
 * @returns {Array}
 */
export const asArray = maybeArray =>
  Array.isArray(maybeArray) ? maybeArray : [maybeArray];

/**
 * Conditionally calls a function if the `fn` parameter is of type function.
 *
 * @param {Function|*} fn - Parameter to call if it is a function.
 * @param {*} [returnIfNotFn] - Parameter to return if `fn` is not a function.
 * @param {*[]} [args=[]] - List of arguments to pass to the `fn` parameter if
 *  it's a function.
 * @returns {*} Result of `fn` being called with `args` if it is a function, or
 *  `returnIfNotFn` otherwise.
 */
export const callIfFn = (fn, returnIfNotFn, args = []) => {
  if (typeof fn === 'function') return fn(...args);
  return returnIfNotFn;
};

/**
 * Parses `values` out of URL search parameters and returns them as a map.
 */
export const valuesFromQueryParams = queryParams => {
  return Object.entries(Object.fromEntries([...queryParams])).reduce(
    (values, [key, value]) => {
      if (key.startsWith('values[')) {
        const vk = key.match(/values\[(.*?)\]/)[1];
        return { ...values, [vk]: value };
      }
      return values;
    },
    {},
  );
};

export const timeAgo = date =>
  formatDistance(date, new Date(), { addSuffix: true });

/**
 * Validates email address using regex.
 */
export const validateEmail = email => {
  return String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    );
};

/**
 * Creates a comparison function for sorting by a value of an object, with the
 * value accessed by key or using the provided function.
 *
 * @param {string|Function} key Property name of objects to be sorted that you
 *  want to sort by, or a function that takes the object to be sorted and
 *  returns a value to sort on.
 */
export const sortBy = key => (a, b) => {
  if (typeof key === 'function') {
    const va = key(a);
    const vb = key(b);
    return va < vb ? -1 : va > vb ? 1 : 0;
  }
  return a?.[key] < b?.[key] ? -1 : a?.[key] > b?.[key] ? 1 : 0;
};

/**
 * Converts a list of objects to a CSV and downloads it with the provided filename.
 *
 * @param {Object[]} data
 * @param {string} filename
 */
export const downloadCSV = (data, filename) => {
  // Validate data param
  if (
    !Array.isArray(data) ||
    data.length === 0 ||
    data.some(o => typeof o !== 'object')
  ) {
    console.error(
      'The `downloadCSV` function was provided invalid `data`. Data must be an array of objects, and the array cannot be empty.',
    );
    return;
  }

  // Get headers from the first row
  const headers = Object.keys(data[0]);
  // Crate an array to store all the rows, and populate with the headers
  const lines = [headers.join()];
  // Map over the rows and convert each one to a string of comma separated values
  for (const row of data) {
    const values = headers.map(
      key =>
        `"${(((row[key] && typeof row[key]) === 'object' ? JSON.stringify(row[key]) : row[key]) || '').replace(/"/g, '""')}"`,
    );
    lines.push(values.join(','));
  }

  // Download the file
  downloadBlob(
    new Blob([lines.join('\n')], { type: 'text/csv' }),
    filename,
    'csv',
  );
};

export const downloadBlob = (blob, filename, extension) => {
  // Create an invisible A element
  const a = document.createElement('a');
  a.style.display = 'none';
  document.body.appendChild(a);

  // Set the HREF to a Blob representation of the data to be downloaded
  a.href = window.URL.createObjectURL(blob);

  // Use download attribute to set set desired file name
  a.setAttribute('download', `${filename || 'data'}.${extension || 'txt'}`);

  // Trigger the download by simulating click
  a.click();

  // Cleanup
  window.URL.revokeObjectURL(a.href);
  document.body.removeChild(a);
};

/**
 * Signs the user out. The library follows the space meta's `session.logoutUrl`
 * when the sign in has one (SAML2, or OpenID Connect with single logout), which
 * navigates the page to the identity provider and back to the space. Otherwise
 * it ends the session with `/app/logout`, and the bundle is reloaded at its
 * home route so the login screen starts from a clean state, as the plain
 * `/app/logout` link did. The reload stays on the current document rather than
 * navigating to a URL built from the location.
 */
export const signOut = () =>
  logout(() => {
    window.location.hash = '/';
    window.location.reload();
  });
