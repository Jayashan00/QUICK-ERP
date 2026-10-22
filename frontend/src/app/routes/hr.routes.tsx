import { Navigate, type RouteObject } from 'react-router-dom';
import { RequirePermission } from '@/core/permissions/components';
import { TENANT_PERMISSIONS as P } from '@/core/permissions';
import { lazyPage } from './lazyPage';

const hrPage = (section: string) => lazyPage(() => import('@/features/hr/HrPage').then(({ HrPage }) => ({ default: () => <HrPage section={section} /> })));
const ProfilePage = hrPage('profile');
const advancedPage = (section: string) => lazyPage(() => import('@/features/hr/AdvancedHrPage').then(({ AdvancedHrPage }) => ({ default: () => <AdvancedHrPage section={section} /> })));
const pages = [
  ['dashboard', 'dashboard', P.HR.EMPLOYEES_VIEW], ['employees', 'employees', P.HR.EMPLOYEES_VIEW],
  ['attendance', 'attendance', P.HR.ATTENDANCE_VIEW], ['biometric', 'biometric', P.HR.ATTENDANCE_VIEW],
  ['corrections', 'corrections', P.HR.ATTENDANCE_VIEW], ['shifts', 'shifts', P.HR.SHIFTS_VIEW],
  ['roster', 'roster', P.HR.SHIFTS_VIEW], ['leaves', 'leave', P.HR.LEAVE_VIEW],
  ['holidays', 'holidays', P.HR.LEAVE_VIEW], ['overtime', 'overtime', P.HR.OVERTIME_VIEW],
  ['pay-items', 'payitems', P.HR.PAYROLL_VIEW], ['salary-revisions', 'revisions', P.HR.PAYROLL_VIEW],
  ['loans', 'loans', P.HR.PAYROLL_VIEW], ['payroll', 'payroll', P.HR.PAYROLL_VIEW],
  ['payslips', 'payslips', P.HR.PAYSLIPS_VIEW], ['audit', 'audit', P.HR.EMPLOYEES_VIEW],
] as const;

export const hrRoutes: RouteObject[] = [
  { path: 'hr', element: <Navigate to="/hr/dashboard" replace /> },
  ...pages.map(([path, section, permission]) => { const Page = hrPage(section); return { path: `hr/${path}`, element: <RequirePermission permission={permission}><Page /></RequirePermission> }; }),
  ...([
    ['recruitment', P.HR.RECRUITMENT_VIEW], ['onboarding', P.HR.ONBOARDING_VIEW], ['training', P.HR.TRAINING_VIEW],
    ['performance', P.HR.PERFORMANCE_VIEW], ['okr', P.HR.OKR_VIEW], ['feedback', P.HR.FEEDBACK_VIEW],
    ['policies', P.HR.POLICIES_VIEW], ['signatures', P.HR.POLICIES_VIEW], ['tickets', P.HR.TICKETS_VIEW],
    ['approvals', P.HR.EMPLOYEES_VIEW], ['calendar', P.HR.EMPLOYEES_VIEW], ['reminders', P.HR.EMPLOYEES_VIEW],
    ['assets', P.HR.ASSETS_VIEW], ['exits', P.HR.EXITS_VIEW], ['analytics', P.HR.REPORTS_VIEW], ['reports', P.HR.REPORTS_VIEW], ['advanced-audit', P.HR.REPORTS_VIEW],
  ] as const).map(([section, permission]) => { const Page = advancedPage(section); return { path: `hr/${section}`, element: <RequirePermission permission={permission}><Page /></RequirePermission> }; }),
  { path: 'hr/employees/:id', element: <RequirePermission permission={P.HR.EMPLOYEES_VIEW}><ProfilePage /></RequirePermission> },
  { path: 'hr/departments', element: <Navigate to="/settings/departments" replace /> },
  { path: 'hr/designations', element: <Navigate to="/settings/designations" replace /> },
];
