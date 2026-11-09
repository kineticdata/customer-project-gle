import { bundle, getCsrfToken } from '@kineticdata/react';

const handleResponse = async response => {
  const data = await response.json();
  if (!response.ok) throw data;
  return data;
};

const handleError = error => {
  if (typeof error === 'object') {
    const { error: m1, errorKey: key = null, message: m2, ...rest } = error;
    const message = m1 || m2 || 'Unexpected error occurred.';
    return { error: { ...rest, message, key } };
  }
  return { error: { message: 'Unexpected error occurred.' } };
};

export const executeIntegration = ({
  kappSlug,
  formSlug,
  integrationName,
  parameters,
}) =>
  fetch(
    [
      `${bundle.apiLocation()}/integrations/kapps/${kappSlug}`,
      formSlug && `/forms/${formSlug}`,
      `/${integrationName}`,
    ]
      .filter(Boolean)
      .join(''),
    {
      method: 'POST',
      body: JSON.stringify(parameters),
      headers: { 'X-XSRF-TOKEN': getCsrfToken() },
    },
  )
    .then(handleResponse)
    .catch(handleError);

/**
 * Calls the business-calendar WebAPI, which runs the same "Business Calendar
 * Calculate" routine that workflows use, so the portal never does its own
 * business-day math.
 *
 * @param {string} kappSlug
 * @param {Object} params Query parameters: op (add_duration, is_business_day,
 *  next_business_day, previous_business_day, business_days_between,
 *  business_hours_between, is_business_time or next_business_opening),
 *  calendar (submission id; blank uses the default), from / date / start, end,
 *  amount, unit (business_days, calendar_days, weeks or business_hours),
 *  direction, adjust and time.
 * @returns {Promise<Object>} The result ({ operation, calendar, result,
 *  warnings }) or { error: { message, key } }.
 */
export const businessCalendar = (kappSlug, params) =>
  fetch(
    `${bundle.spaceLocation()}/app/kapps/${kappSlug}/webApis/business-calendar?${new URLSearchParams(
      { timeout: '10', ...params },
    )}`,
  )
    .then(handleResponse)
    .catch(error =>
      error?.error?.code
        ? { error: { message: error.error.message, key: error.error.code } }
        : handleError(error),
    );
