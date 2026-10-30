import type {
  NavigationItemConfig,
  NavigationSectionConfig,
} from '@/app/config/navigationConfig';
import type { PermissionCheck } from './permissionTypes';
import type { TenantModule } from '@/core/tenant/tenantEntitlements';
import { moduleForPath, moduleForPermission } from '@/core/tenant/tenantEntitlements';

function canViewItem(
  item: NavigationItemConfig,
  hasPermission: (check: PermissionCheck) => boolean,
) {
  if (item.permission && !hasPermission(item.permission)) return false;
  if (item.anyPermissions && !hasPermission({ any: item.anyPermissions })) return false;
  if (item.allPermissions && !hasPermission({ all: item.allPermissions })) return false;
  return true;
}

function filterItem(
  item: NavigationItemConfig,
  hasPermission: (check: PermissionCheck) => boolean,
  isModuleEnabled?: (module: TenantModule) => boolean,
): NavigationItemConfig | null {
  const module = item.path ? moduleForPath(item.path) : item.permission ? moduleForPermission(item.permission) : null;
  if (module && isModuleEnabled && !isModuleEnabled(module)) return null;
  const children = item.children
    ?.map((child) => filterItem(child, hasPermission, isModuleEnabled))
    .filter((child): child is NavigationItemConfig => child !== null);

  if (item.children?.length) {
    if (!children?.length) return null;
    return { ...item, children };
  }

  return canViewItem(item, hasPermission) ? item : null;
}

export function filterNavigationSections(
  sections: NavigationSectionConfig[],
  hasPermission: (check: PermissionCheck) => boolean,
  isModuleEnabled?: (module: TenantModule) => boolean,
) {
  return sections
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) => filterItem(item, hasPermission, isModuleEnabled))
        .filter((item): item is NavigationItemConfig => item !== null),
    }))
    .filter((section) => section.items.length > 0);
}
