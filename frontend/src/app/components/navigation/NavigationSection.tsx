import type { NavigationSectionConfig } from '@/app/config/navigationConfig';
import { cn } from '@/shared/utils/cn';

import { NavigationItem } from './NavigationItem';

interface NavigationSectionProps {
  section: NavigationSectionConfig;
  collapsed: boolean;
  onNavigate?: () => void;
}

export function NavigationSection({ section, collapsed, onNavigate }: NavigationSectionProps) {
  return (
    <section aria-label={section.title}>
      {section.title && (
        <h2
          className={cn(
            'mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400',
            collapsed && 'lg:sr-only',
          )}
        >
          {section.title}
        </h2>
      )}
      <div className="space-y-1">
        {section.items.map((item) => (
          <NavigationItem
            key={item.path || item.label}
            item={item}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  );
}
