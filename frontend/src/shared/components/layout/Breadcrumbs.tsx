import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

/**
 * Auto-generates breadcrumbs from the current URL path.
 * Can also accept manual overrides via props.
 */
export function Breadcrumbs({ items }: { items?: BreadcrumbItem[] }) {
  const location = useLocation();

  const crumbs = useMemo(() => {
    if (items) return items;

    const segments = location.pathname.split('/').filter(Boolean);
    const autoCrumbs: BreadcrumbItem[] = [{ label: 'Home', path: '/dashboard' }];

    let currentPath = '';
    for (const segment of segments) {
      currentPath += `/${segment}`;
      // Skip dynamic params (e.g., UUIDs)
      if (segment.match(/^[0-9a-f-]{8,}$/i)) continue;
      const label = segment
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      autoCrumbs.push({ label, path: currentPath });
    }

    // Last crumb has no link
    if (autoCrumbs.length > 1) {
      delete autoCrumbs[autoCrumbs.length - 1].path;
    }

    return autoCrumbs;
  }, [items, location.pathname]);

  return (
    <nav className="mb-4" aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
      {crumbs.map((crumb, idx) => (
        <li key={`${crumb.label}-${idx}`} className="flex items-center gap-1">
          {idx > 0 && <ChevronRight size={14} className="text-slate-400" aria-hidden="true" />}
          {crumb.path ? (
            <Link to={crumb.path} className="rounded-sm transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              {crumb.label}
            </Link>
          ) : (
            <span className="font-medium text-slate-700" aria-current="page">{crumb.label}</span>
          )}
        </li>
      ))}
      </ol>
    </nav>
  );
}
