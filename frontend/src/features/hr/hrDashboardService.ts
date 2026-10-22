import { hrService } from './hrService';
import { departmentService } from '@/features/settings/organization/services/departmentService';
import type { ModuleDashboardContext } from '@/features/dashboard/types/moduleDashboard';
import { addList, group, recordLink, sum, timeSeries } from '@/features/dashboard/utils/moduleAnalytics';

export async function aggregateHrDashboard(context: ModuleDashboardContext) {
  const { scope, can, output, inPeriod, today } = context;
  if (!can('hr.employees.view')) return;
  const workers = hrService.employees(scope, scope.branchId);
  const departments = await departmentService.getAllDepartments(scope.tenantId);
  const employeeName = (id: string) => { const row = workers.find(row => row.id === id); return row ? `${row.firstName} ${row.lastName}` : id; };
  output.metrics.push({ label: 'Total employees', value: workers.length, description: 'Current branch headcount', to: '/hr/employees' });
  output.charts.push({ id: 'departments', title: 'Employees by Department', subtitle: 'Current headcount by department', data: group(workers, row => departments.find(item => item.id === row.departmentId)?.name ?? row.departmentName ?? row.departmentId), to: '/hr/employees' });
  if (can('hr.attendance.view')) {
    const all = hrService.attendance(scope, scope.branchId), selected = all.filter(row => inPeriod(row.date));
    const todayRows = all.filter(row => row.date === today);
    output.metrics.push({ label: 'Present today', value: todayRows.filter(row => ['present', 'late', 'early_leave'].includes(row.status)).length, description: 'Today / includes late arrivals', to: '/hr/attendance' }, { label: 'On leave today', value: todayRows.filter(row => row.status === 'on_leave').length, description: 'Today / recorded attendance', to: '/hr/attendance' });
    output.charts.unshift({ id: 'attendance-trend', title: 'Attendance Trend', subtitle: 'Daily attendance records in selected period', kind: 'area', wide: true, primaryLabel: 'Present / late', secondaryLabel: 'Absent / leave', data: timeSeries(context, selected, row => row.date, row => ['present', 'late', 'early_leave'].includes(row.status) ? 1 : 0, row => ['absent', 'on_leave'].includes(row.status) ? 1 : 0), to: '/hr/attendance', emptyMessage: 'No attendance data available for this period.' });
    output.charts.push({ id: 'attendance-status', title: 'Attendance Summary', subtitle: 'Recorded attendance statuses in selected period', kind: 'donut', data: group(selected, row => row.status), to: '/hr/attendance' });
    addList(context, 'Attendance Exceptions', selected.filter(row => row.status === 'absent' || row.status === 'late' || row.exception).sort((a, b) => b.date.localeCompare(a.date)).map(row => ({ id: row.id, title: employeeName(row.employeeId), description: row.exception ?? row.status, date: row.date, status: row.status, to: '/hr/attendance' })), { subtitle: 'Attendance exceptions in selected period', to: '/hr/attendance' });
  }
  if (can('hr.leave.view')) {
    const leaves = hrService.leaves(scope, scope.branchId), types = hrService.leaveTypes(scope.tenantId);
    const pending = leaves.filter(row => row.status === 'pending');
    output.metrics.push({ label: 'Pending leave', value: pending.length, description: 'Current request queue', to: '/hr/leaves' });
    output.charts.push({ id: 'leave-types', title: 'Leave Distribution', subtitle: 'Approved leave days starting in selected period', data: group(leaves.filter(row => row.status === 'approved' && inPeriod(row.startDate)), row => types.find(type => type.id === row.typeId)?.name ?? row.typeId, row => row.days), to: '/hr/leaves' });
    if (can('hr.leave.approve')) addList(context, 'Pending Leave Approvals', pending.sort((a, b) => a.startDate.localeCompare(b.startDate)).map(row => ({ id: row.id, title: employeeName(row.employeeId), description: `${types.find(type => type.id === row.typeId)?.name ?? row.typeId} / ${row.days} days`, date: row.startDate, status: row.status, to: recordLink('/hr/leaves', row.id) })), { to: '/hr/leaves', emptyMessage: 'No leave requests awaiting approval.' });
  }
  if (can('hr.payroll.view')) {
    const payrolls = hrService.payrolls(scope, scope.branchId);
    output.metrics.push({ label: 'Payroll awaiting review', value: payrolls.filter(row => row.status !== 'approved').length, description: 'Current unapproved payroll runs', to: '/hr/payroll' });
    const selected = payrolls.filter(row => inPeriod(`${row.period}-01`) && row.status === 'approved');
    output.charts.push({ id: 'payroll', title: 'Approved Payroll Trend', subtitle: 'Net payroll grouped by payroll period in selected date range', kind: 'area', currency: true, data: timeSeries(context, selected, row => `${row.period}-01`, row => sum(row.lines, line => line.net)), to: '/hr/payroll', emptyMessage: 'No approved payroll periods in this range.' });
  }
  addList(context, 'Recent Employees', workers.filter(row => inPeriod(row.dateOfJoining)).sort((a, b) => b.dateOfJoining.localeCompare(a.dateOfJoining)).map(row => ({ id: row.id, title: `${row.firstName} ${row.lastName}`, description: row.departmentName, date: row.dateOfJoining, status: row.status, to: `/hr/employees/${row.id}` })), { subtitle: 'Employees who joined in selected period', to: '/hr/employees', emptyMessage: 'No employees joined during this period.' });
  output.workflowDescription = 'Employees > Shifts > Attendance > Leave > Payroll Review > Payslips';
  output.workflow = [['Employees', '/hr/employees', 'hr.employees.view'], ['Shifts', '/hr/shifts', 'hr.shifts.view'], ['Attendance', '/hr/attendance', 'hr.attendance.view'], ['Leave', '/hr/leaves', 'hr.leave.view'], ['Payroll', '/hr/payroll', 'hr.payroll.view'], ['Payslips', '/hr/payslips', 'hr.payslips.view']].filter(([, , permission]) => can(permission)).map(([label, to]) => ({ label, to }));
}
