import type { User } from '@/core/auth/types/user';
import { mockTenants } from '@/core/tenant/mocks/tenants';
import type { Tenant } from '@/core/tenant/types/tenant';
import { roleService } from '@/core/permissions/roleService';
import { toUrlSlug } from '@/shared/utils/slug';

export interface TenantRouteIdentity {
  companySlug: string;
  roleSlug: string;
  userSlug: string;
}

export interface BuildTenantPathInput extends TenantRouteIdentity {
  path?: string;
}

const GLOBAL_PATH_PREFIXES = ['/login', '/forgot-password', '/reset-password', '/verify-email', '/two-factor', '/security-check', '/super-admin', '/shop', '/unauthorized', '/forbidden', '/error'];
const LEGACY_TENANT_ROOTS = new Set(['dashboard', 'profile', 'security', 'sync', 'crm', 'customers', 'suppliers', 'products', 'sales', 'purchases', 'inventory', 'stock', 'pos', 'finance', 'accounting', 'hr', 'projects', 'reports', 'documents', 'support', 'audit', 'notifications', 'settings']);

const splitSuffix = (path: string) => {
  const index = path.search(/[?#]/);
  return index < 0 ? { pathname: path, suffix: '' } : { pathname: path.slice(0, index), suffix: path.slice(index) };
};

export function buildTenantPath({ companySlug, roleSlug, userSlug, path = '/dashboard' }: BuildTenantPathInput): string {
  if (path.startsWith('#') || /^(?:https?:)?\/\//.test(path)) return path;
  const { pathname, suffix } = splitSuffix(path);
  if (GLOBAL_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return `${pathname}${suffix}`;
  const base = `/${toUrlSlug(companySlug)}/${toUrlSlug(roleSlug)}/${toUrlSlug(userSlug)}`;
  if (pathname === base || pathname.startsWith(`${base}/`)) return `${pathname}${suffix}`;
  const relative = pathname === '/' || pathname === '' ? '/dashboard' : `/${pathname.replace(/^\/+/, '')}`;
  return `${base}${relative}${suffix}`;
}

export function getTenantRouteIdentity(user: User | null | undefined, tenant?: Tenant | null): TenantRouteIdentity | null {
  if (!user || user.isSuperAdmin || user.tenantId === 'platform') return null;
  const resolvedTenant = tenant ?? mockTenants.find((candidate) => candidate.id === user.tenantId) ?? null;
  if (!resolvedTenant) return null;
  const role = roleService.getCachedRoleById(user.tenantId, user.roleId);
  return {
    companySlug: resolvedTenant.slug || toUrlSlug(resolvedTenant.subdomain || resolvedTenant.name),
    roleSlug: role?.slug || toUrlSlug(user.roleName),
    userSlug: user.slug || toUrlSlug(user.name),
  };
}

export function buildUserTenantPath(user: User, path = '/dashboard', tenant?: Tenant | null): string {
  const identity = getTenantRouteIdentity(user, tenant);
  return identity ? buildTenantPath({ ...identity, path }) : '/super-admin/dashboard';
}

export function resolvePostLoginPath(user: User, requestedPath?: string): string {
  if (user.isSuperAdmin) return '/super-admin/dashboard';
  const identity = getTenantRouteIdentity(user);
  if (!identity) return '/unauthorized';
  if (requestedPath && isTenantPathForIdentity(requestedPath, identity)) return requestedPath;
  if (requestedPath) {
    const { pathname } = splitSuffix(requestedPath);
    const previousTenantPath = requestedPath.match(/^\/vyro\/[^/]+\/[^/]+(?<rest>\/.*)?(?<suffix>[?#].*)?$/);
    if (previousTenantPath) return buildTenantPath({ ...identity, path: `${previousTenantPath.groups?.rest || '/dashboard'}${previousTenantPath.groups?.suffix || ''}` });
    if (isLegacyTenantPath(pathname)) return buildTenantPath({ ...identity, path: requestedPath });
  }
  return buildTenantPath({ ...identity, path: '/dashboard' });
}

export function stripTenantPath(pathname: string): string {
  const match = pathname.match(/^\/[^/]+\/[^/]+\/[^/]+(?<rest>\/.*)?$/);
  return match?.groups?.rest || '/dashboard';
}

export function isLegacyTenantPath(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname === '/vyro' || pathname.startsWith('/vyro/')) return true;
  const root = pathname.split('/').filter(Boolean)[0];
  return Boolean(root && LEGACY_TENANT_ROOTS.has(root));
}

export function isTenantPathForIdentity(path: string, identity: TenantRouteIdentity): boolean {
  const { pathname } = splitSuffix(path);
  const base = `/${identity.companySlug}/${identity.roleSlug}/${identity.userSlug}`;
  return pathname === base || pathname.startsWith(`${base}/`);
}
