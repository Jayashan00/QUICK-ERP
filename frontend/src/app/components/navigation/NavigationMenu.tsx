import type { NavigationSectionConfig } from '@/app/config/navigationConfig';

import { NavigationSection } from './NavigationSection';

interface NavigationMenuProps {
  sections: NavigationSectionConfig[];
  collapsed: boolean;
  onNavigate?: () => void;
}

export function NavigationMenu({ sections, collapsed, onNavigate }: NavigationMenuProps) {
  return (
    <nav aria-label="Main navigation" className="space-y-5">
      {sections.map((section) => (
        <NavigationSection
          key={section.title || section.items[0]?.label}
          section={section}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}
