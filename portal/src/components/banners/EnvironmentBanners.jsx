import t from 'prop-types';
import { EnvironmentBanner } from '@kineticdata/react';

/**
 * The space's Environment Banner (for example a classification marking), drawn by the toolkit so
 * it looks the same as on the platform's own pages. Place it at the top of the layout, and again
 * with placement="bottom"; the bottom one only shows when the space puts the banner at the top and
 * bottom. It is in the page flow (flex-none), so it never covers content.
 */
export const EnvironmentBanners = ({ placement = 'top' }) => (
  <div className="flex-none">
    <EnvironmentBanner placement={placement} />
  </div>
);

EnvironmentBanners.propTypes = {
  placement: t.oneOf(['top', 'bottom']),
};
