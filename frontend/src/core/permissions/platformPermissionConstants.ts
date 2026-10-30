function buildPlatformPerms<T extends string>(resources: readonly T[], actions: readonly string[]) {
  const result: Record<string, string> = {};
  for (const resource of resources) {
    for (const action of actions) result[`${resource}_${action}`.toUpperCase()] = `platform.${resource}.${action}`;
  }
  return result;
}

/** Permissions available only inside the Quick ERP platform console. */
export const PLATFORM_PERMISSIONS = {
  SUPER_ADMIN: buildPlatformPerms(
    ['dashboard', 'tenants', 'usage', 'reports', 'settings', 'maintenance', 'security', 'users', 'audit_logs', 'support', 'health'] as const,
    ['view', 'create', 'edit', 'delete', 'configure'],
  ),
} as const;
