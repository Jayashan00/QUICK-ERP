import { Link, type LinkProps } from 'react-router-dom';
import { useTenantRoute } from './useTenantRoute';

export function TenantLink({ to, ...props }: LinkProps) {
  const { toTenantPath } = useTenantRoute();
  const routedTo = typeof to === 'string'
    ? toTenantPath(to)
    : { ...to, pathname: to.pathname ? toTenantPath(to.pathname) : to.pathname };
  return <Link to={routedTo} {...props} />;
}
