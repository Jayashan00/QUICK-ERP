import { Navigate, type RouteObject } from 'react-router-dom';
import { RequirePermission } from '@/core/permissions/components';
import { TENANT_PERMISSIONS as P } from '@/core/permissions';
import { lazyPage } from './lazyPage';

const page = (section: string) => lazyPage(() => import('@/features/projects/ProjectsPage').then(({ ProjectsPage }) => ({ default: () => <ProjectsPage section={section} /> })));
const sections = [
  ['dashboard', P.PROJECTS.PROJECTS_VIEW], ['list', P.PROJECTS.PROJECTS_VIEW], ['milestones', P.PROJECTS.MILESTONES_VIEW],
  ['tasks', P.PROJECTS.TASKS_VIEW], ['team', P.PROJECTS.PROJECTS_VIEW], ['timesheets', P.PROJECTS.TIMESHEETS_VIEW],
  ['expenses', P.PROJECTS.EXPENSES_VIEW], ['billing', P.PROJECTS.BILLING_VIEW], ['profitability', P.PROJECTS.REPORTS_VIEW],
  ['reports', P.PROJECTS.REPORTS_VIEW], ['audit', P.PROJECTS.PROJECTS_VIEW],
] as const;
export const projectRoutes: RouteObject[] = [
  { path: 'projects', element: <Navigate to="/projects/dashboard" replace /> },
  ...sections.map(([section, permission]) => { const Page = page(section); return { path: `projects/${section}`, element: <RequirePermission permission={permission}><Page /></RequirePermission> }; }),
  { path: 'projects/:id', element: <RequirePermission permission={P.PROJECTS.PROJECTS_VIEW}>{(() => { const Page = page('detail'); return <Page />; })()}</RequirePermission> },
];
