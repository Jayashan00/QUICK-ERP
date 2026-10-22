import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Card } from '@/shared/components/common/Card';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { usePermissions } from '@/core/permissions/permission-context';
import { SETTINGS_NAV_GROUPS } from '@/features/settings/config/settingsNavConfig';

export function SettingsLandingPage() {
  const { hasPermission } = usePermissions();

  const allowedGroups = SETTINGS_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      item.permission ? hasPermission(item.permission) : true,
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Administration"
        description="Configure organization profile, operational branch sites, corporate departments, team access, and regional preferences."
      />

      {allowedGroups.length === 0 ? (
        <Card><EmptyState title="No settings available" message="Your role does not currently include access to a tenant settings module." /></Card>
      ) : (
        <div className="space-y-8">
          {allowedGroups.map((group) => {
            const GroupIcon = group.icon;
            return (
              <section key={group.id} aria-labelledby={`settings-${group.id}`}>
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <GroupIcon size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 id={`settings-${group.id}`} className="font-semibold text-slate-900">
                      {group.label}
                    </h2>
                    <p className="text-sm text-slate-500">{group.description}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className="group block rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <Card className="h-full p-5 transition-shadow duration-150 hover:border-blue-200 hover:shadow-md">
                          <div className="flex items-start justify-between">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                              <Icon size={20} />
                            </div>
                            <ArrowRight
                              size={16}
                              className="text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-blue-600"
                            />
                          </div>
                          <h3 className="mt-4 text-base font-semibold text-slate-900 group-hover:text-blue-600">
                            {item.label}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                            {item.description}
                          </p>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
