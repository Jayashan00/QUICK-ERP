import { mockEmployees } from './mocks/employees';
import type { Employee } from './types/employee';
import { departmentService } from '@/features/settings/organization/services/departmentService';
import { designationService } from '@/features/settings/organization/services/designationService';
import type { DocumentRecord } from '@/shared/types/document-record';
import { documentService } from '@/features/documents/documentService';
import { auditEventService } from '@/core/audit';
import { salesStore } from '@/features/sales/services/salesStore';
import { registerList, replaceArray } from '@/core/persistence/stateRegistry';

export type HrScope = { tenantId: string; branchId: string; permittedBranchIds: string[] };
export type HrActor = { id: string; name: string };
export type HrAudit = { id: string; tenantId: string; branchId: string; employeeId?: string; reference: string; action: string; actor: string; at: string; note?: string };
export type Shift = { id: string; tenantId: string; branchId: string; name: string; start: string; end: string; breakMinutes: number; active: boolean };
export type Roster = { id: string; tenantId: string; branchId: string; employeeId: string; shiftId: string; date: string };
export type Attendance = { id: string; tenantId: string; branchId: string; employeeId: string; date: string; shiftId?: string; checkIn?: string; checkOut?: string; status: 'present' | 'absent' | 'late' | 'early_leave' | 'on_leave'; overtimeHours: number; source: 'manual' | 'biometric' | 'leave'; leaveId?: string; exception?: string };
export type Correction = { id: string; tenantId: string; branchId: string; attendanceId: string; employeeId: string; requestedIn: string; requestedOut: string; reason: string; status: 'pending' | 'approved' | 'rejected'; remarks?: string };
export type LeaveType = { id: string; tenantId: string; name: string; annualDays: number; paid: boolean; active: boolean };
export type Leave = { id: string; tenantId: string; branchId: string; employeeId: string; typeId: string; startDate: string; endDate: string; days: number; reason: string; attachment?: string; status: 'pending' | 'approved' | 'rejected' | 'cancelled'; remarks?: string };
export type Holiday = { id: string; tenantId: string; branchId?: string; date: string; name: string; type: 'public' | 'company'; active: boolean };
export type Overtime = { id: string; tenantId: string; branchId: string; employeeId: string; date: string; hours: number; status: 'pending' | 'approved' | 'rejected'; remarks?: string };
export type PayItem = { id: string; tenantId: string; branchId: string; employeeId: string; kind: 'allowance' | 'deduction'; name: string; amount: number; active: boolean };
export type SalaryRevision = { id: string; tenantId: string; branchId: string; employeeId: string; effectiveDate: string; amount: number; status: 'pending' | 'approved' | 'rejected' };
export type Loan = { id: string; tenantId: string; branchId: string; employeeId: string; type: string; amount: number; installments: number; outstanding: number; status: 'pending' | 'approved' | 'rejected' | 'repaid' };
export type PayrollLine = { employeeId: string; base: number; allowance: number; overtime: number; commission: number; deduction: number; loanRecovery: number; contributionBase: number; employeeEpf: number; employerEpf: number; employerEtf: number; gross: number; net: number };
export type Payroll = { id: string; tenantId: string; branchId: string; period: string; status: 'draft' | 'review' | 'approved'; lines: PayrollLine[]; createdAt: string; approvedAt?: string };
export type CommissionInput = { id: string; tenantId: string; branchId: string; period: string; paymentId: string; invoiceId: string; salespersonId: string; employeeId: string; collectedAmount: number; rate: number; amount: number; status: 'pending' | 'approved' | 'rejected'; payrollId?: string; preparedAt: string; reviewedAt?: string; reviewedBy?: string };
export type BiometricRow = { row: number; employeeCode: string; date: string; checkIn: string; checkOut: string; status: 'valid' | 'exception'; error?: string };

let employees = structuredClone(mockEmployees);
const shifts: Shift[] = [{ id: 'shift-001', tenantId: 'tenant-001', branchId: 'branch-001', name: 'Day shift', start: '09:00', end: '17:00', breakMinutes: 60, active: true }];
const rosters: Roster[] = [{ id: 'roster-001', tenantId: 'tenant-001', branchId: 'branch-001', employeeId: 'emp-001', shiftId: 'shift-001', date: new Date().toISOString().slice(0, 10) }, { id: 'roster-002', tenantId: 'tenant-001', branchId: 'branch-001', employeeId: 'emp-002', shiftId: 'shift-001', date: new Date().toISOString().slice(0, 10) }];
const attendance: Attendance[] = [
  { id: 'att-001', tenantId: 'tenant-001', branchId: 'branch-001', employeeId: 'emp-001', date: new Date().toISOString().slice(0, 10), shiftId: 'shift-001', checkIn: '09:08', checkOut: '17:05', status: 'late', overtimeHours: 0, source: 'manual' },
  { id: 'att-002', tenantId: 'tenant-001', branchId: 'branch-001', employeeId: 'emp-002', date: new Date().toISOString().slice(0, 10), shiftId: 'shift-001', checkIn: '08:58', checkOut: '17:12', status: 'present', overtimeHours: 0, source: 'biometric' },
  { id: 'att-003', tenantId: 'tenant-001', branchId: 'branch-002', employeeId: 'emp-003', date: new Date().toISOString().slice(0, 10), status: 'absent', overtimeHours: 0, source: 'manual' },
];
const corrections: Correction[] = [];
const leaveTypes: LeaveType[] = [{ id: 'leave-annual', tenantId: 'tenant-001', name: 'Annual leave', annualDays: 20, paid: true, active: true }, { id: 'leave-sick', tenantId: 'tenant-001', name: 'Sick leave', annualDays: 10, paid: true, active: true }];
const leaves: Leave[] = [{ id: 'leave-001', tenantId: 'tenant-001', branchId: 'branch-001', employeeId: 'emp-004', typeId: 'leave-annual', startDate: '2026-10-05', endDate: '2026-10-06', days: 2, reason: 'Family event', status: 'pending' }];
const holidays: Holiday[] = [{ id: 'holiday-001', tenantId: 'tenant-001', date: '2026-12-25', name: 'Christmas Day', type: 'public', active: true }];
const overtime: Overtime[] = [{ id: 'ot-001', tenantId: 'tenant-001', branchId: 'branch-001', employeeId: 'emp-002', date: '2026-09-28', hours: 2, status: 'approved' }];
const payItems: PayItem[] = [{ id: 'payitem-001', tenantId: 'tenant-001', branchId: 'branch-001', employeeId: 'emp-002', kind: 'allowance', name: 'Transport allowance', amount: 150, active: true }];
const revisions: SalaryRevision[] = [];
const loans: Loan[] = [];
const payrolls: Payroll[] = [{ id: 'payroll-2026-08', tenantId: 'tenant-001', branchId: 'branch-001', period: '2026-08', status: 'approved', createdAt: '2026-08-31T08:00:00Z', approvedAt: '2026-09-01T09:00:00Z', lines: [{ employeeId: 'emp-001', base: 8500, allowance: 0, overtime: 0, commission: 0, deduction: 0, loanRecovery: 0, contributionBase: 8500, employeeEpf: 680, employerEpf: 1020, employerEtf: 255, gross: 8500, net: 7820 }, { employeeId: 'emp-002', base: 7200, allowance: 0, overtime: 0, commission: 0, deduction: 0, loanRecovery: 0, contributionBase: 7200, employeeEpf: 576, employerEpf: 864, employerEtf: 216, gross: 7200, net: 6624 }] }];
const commissions: CommissionInput[] = [];
const auditLog: HrAudit[] = [];
const uid = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const round = (value: number) => Math.round(value * 100) / 100;
export function calculateStatutoryContributions(base: number, allowance: number, commission: number) {
  const contributionBase = round(base + allowance + commission);
  return { contributionBase, employeeEpf: round(contributionBase * 0.08), employerEpf: round(contributionBase * 0.12), employerEtf: round(contributionBase * 0.03) };
}
const today = () => new Date().toISOString().slice(0, 10);
const permitted = (scope: HrScope, branchId: string) => scope.permittedBranchIds.includes(branchId);
function assertBranch(scope: HrScope, branchId: string) { if (!scope.tenantId || !permitted(scope, branchId)) throw new Error('Branch access is not permitted.'); }
function audit(scope: HrScope, actor: HrActor, action: string, reference: string, employeeId?: string, note?: string) {
  const event: HrAudit = { id: uid('hr-audit'), tenantId: scope.tenantId, branchId: scope.branchId, employeeId, action, reference, actor: actor.name, at: new Date().toISOString(), note };
  auditLog.unshift(event);
  auditEventService.record({ id: `tenant-${event.id}`, tenantId: event.tenantId, branchId: event.branchId, actorId: actor.id, actorName: actor.name, module: 'hr', entityType: employeeId ? 'Employee Record' : 'HR Record', entityId: employeeId ?? reference, reference, action, description: `${actor.name} ${action.toLowerCase()} ${reference}.`, remarks: note, createdAt: event.at, relatedRoute: '/hr', sensitivity: 'sensitive' });
}
function visible<T extends { tenantId: string; branchId: string }>(rows: T[], scope: HrScope, branchId?: string) { return rows.filter((row) => row.tenantId === scope.tenantId && permitted(scope, row.branchId) && (!branchId || row.branchId === branchId)); }
function employee(scope: HrScope, id: string) { const item = employees.find((row) => row.id === id && row.tenantId === scope.tenantId && permitted(scope, row.branchId)); if (!item) throw new Error('Employee not found in permitted branches.'); return item; }
function hours(start: string, end: string) { const [sh, sm] = start.split(':').map(Number), [eh, em] = end.split(':').map(Number); return (eh * 60 + em - sh * 60 - sm) / 60; }
function days(start: string, end: string) { return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1; }

export const hrService = {
  employees: (scope: HrScope, branchId?: string) => visible(employees, scope, branchId),
  employee: (scope: HrScope, id: string) => employee(scope, id),
  async saveEmployee(scope: HrScope, actor: HrActor, input: Omit<Employee, 'id' | 'tenantId' | 'departmentName' | 'designationName' | 'createdAt' | 'updatedAt'> & { id?: string }) {
    assertBranch(scope, input.branchId);
    if (!input.employeeCode.trim() || !input.firstName.trim() || !input.lastName.trim() || !/^\S+@\S+\.\S+$/.test(input.email) || input.phone.replace(/\D/g, '').length < 7 || !input.dateOfJoining || input.salary < 0) throw new Error('Complete the required employee fields with valid contact and salary details.');
    if (input.exitDate && input.exitDate < input.dateOfJoining) throw new Error('Exit date cannot precede joining date.');
    if (employees.some((row) => row.tenantId === scope.tenantId && row.employeeCode === input.employeeCode && row.id !== input.id)) throw new Error('Employee code already exists.');
    const department = await departmentService.getDepartmentById(scope.tenantId, input.departmentId);
    const designation = await designationService.getDesignationById(scope.tenantId, input.designationId);
    if (!department || !designation || designation.departmentId !== department.id) throw new Error('Choose a valid department and its designation.');
    if (input.reportingManagerId && input.reportingManagerId === input.id) throw new Error('Employee cannot report to themselves.');
    if (input.reportingManagerId) employee(scope, input.reportingManagerId);
    const previous = input.id ? employee(scope, input.id) : undefined;
    const now = new Date().toISOString();
    const item: Employee = { ...input, id: input.id ?? uid('emp'), tenantId: scope.tenantId, departmentName: department.name, designationName: designation.name, createdAt: previous?.createdAt ?? now, updatedAt: now };
    employees = [item, ...employees.filter((row) => row.id !== item.id)];
    audit({ ...scope, branchId: input.branchId }, actor, previous ? 'Employee updated' : 'Employee created', item.employeeCode, item.id);
    return item;
  },
  shifts: (scope: HrScope, branchId?: string) => visible(shifts, scope, branchId),
  saveShift(scope: HrScope, actor: HrActor, input: Omit<Shift, 'id' | 'tenantId'> & { id?: string }) {
    assertBranch(scope, input.branchId);
    if (!input.name.trim() || !/^\d{2}:\d{2}$/.test(input.start) || !/^\d{2}:\d{2}$/.test(input.end) || hours(input.start, input.end) <= 0 || input.breakMinutes < 0 || input.breakMinutes >= hours(input.start, input.end) * 60) throw new Error('Enter valid shift times and break duration.');
    const item = { ...input, id: input.id ?? uid('shift'), tenantId: scope.tenantId };
    const index = shifts.findIndex((row) => row.id === item.id && row.tenantId === scope.tenantId && permitted(scope, row.branchId));
    if (input.id && index < 0) throw new Error('Shift not found.');
    if (index >= 0) shifts[index] = item; else shifts.unshift(item);
    audit({ ...scope, branchId: input.branchId }, actor, input.id ? 'Shift updated' : 'Shift created', item.name);
    return item;
  },
  rosters: (scope: HrScope, branchId?: string) => visible(rosters, scope, branchId),
  assignShift(scope: HrScope, actor: HrActor, input: Omit<Roster, 'id' | 'tenantId'>) {
    assertBranch(scope, input.branchId);
    const worker = employee(scope, input.employeeId);
    const shift = shifts.find((row) => row.id === input.shiftId && row.tenantId === scope.tenantId && row.branchId === input.branchId && row.active);
    if (worker.branchId !== input.branchId || !shift || !input.date) throw new Error('Choose an employee and active shift in the same branch.');
    const prior = rosters.find((row) => row.tenantId === scope.tenantId && row.employeeId === input.employeeId && row.date === input.date);
    if (prior) prior.shiftId = input.shiftId;
    else rosters.unshift({ ...input, id: uid('roster'), tenantId: scope.tenantId });
    audit({ ...scope, branchId: input.branchId }, actor, 'Roster assigned', input.date, input.employeeId);
  },
  attendance: (scope: HrScope, branchId?: string) => visible(attendance, scope, branchId),
  recordAttendance(scope: HrScope, actor: HrActor, input: Omit<Attendance, 'id' | 'tenantId' | 'status' | 'overtimeHours' | 'exception'> & { id?: string }) {
    assertBranch(scope, input.branchId);
    const worker = employee(scope, input.employeeId);
    if (worker.branchId !== input.branchId || !input.date || (input.checkIn && !/^\d{2}:\d{2}$/.test(input.checkIn)) || (input.checkOut && !/^\d{2}:\d{2}$/.test(input.checkOut)) || (input.checkIn && input.checkOut && hours(input.checkIn, input.checkOut) <= 0)) throw new Error('Enter a valid attendance date and time range.');
    if (attendance.some((row) => row.tenantId === scope.tenantId && row.employeeId === input.employeeId && row.date === input.date && row.id !== input.id)) throw new Error('Attendance already exists for this employee and date.');
    const roster = rosters.find((row) => row.tenantId === scope.tenantId && row.employeeId === input.employeeId && row.date === input.date);
    const shift = shifts.find((row) => row.id === (input.shiftId || roster?.shiftId) && row.tenantId === scope.tenantId && row.branchId === input.branchId);
    const status: Attendance['status'] = !input.checkIn ? 'absent' : shift && input.checkIn > shift.start ? 'late' : shift && input.checkOut && input.checkOut < shift.end ? 'early_leave' : 'present';
    const overtimeHours = input.checkIn && input.checkOut && shift ? Math.max(0, round(hours(input.checkIn, input.checkOut) - hours(shift.start, shift.end) + shift.breakMinutes / 60)) : 0;
    const item: Attendance = { ...input, id: input.id ?? uid('att'), tenantId: scope.tenantId, shiftId: shift?.id, status, overtimeHours, exception: input.source === 'biometric' && (!input.checkIn || !input.checkOut) ? 'Missing clock time' : undefined };
    const index = attendance.findIndex((row) => row.id === item.id && row.tenantId === scope.tenantId && permitted(scope, row.branchId));
    if (index >= 0) attendance[index] = item; else attendance.unshift(item);
    audit({ ...scope, branchId: input.branchId }, actor, 'Attendance recorded', input.date, input.employeeId);
    return item;
  },
  corrections: (scope: HrScope, branchId?: string) => visible(corrections, scope, branchId),
  requestCorrection(scope: HrScope, actor: HrActor, input: Pick<Correction, 'attendanceId' | 'requestedIn' | 'requestedOut' | 'reason'>) {
    const original = attendance.find((row) => row.id === input.attendanceId && row.tenantId === scope.tenantId && permitted(scope, row.branchId));
    if (!original || !input.reason.trim() || hours(input.requestedIn, input.requestedOut) <= 0) throw new Error('Choose attendance, valid corrected times and a reason.');
    const item: Correction = { ...input, id: uid('corr'), tenantId: scope.tenantId, branchId: original.branchId, employeeId: original.employeeId, status: 'pending' };
    corrections.unshift(item); audit({ ...scope, branchId: item.branchId }, actor, 'Attendance correction requested', original.date, original.employeeId); return item;
  },
  decideCorrection(scope: HrScope, actor: HrActor, id: string, status: 'approved' | 'rejected', remarks: string) {
    const item = corrections.find((row) => row.id === id && row.tenantId === scope.tenantId && permitted(scope, row.branchId));
    if (!item || item.status !== 'pending') throw new Error('Correction is not pending.');
    item.status = status; item.remarks = remarks;
    if (status === 'approved') { const original = attendance.find((row) => row.id === item.attendanceId)!; this.recordAttendance({ ...scope, branchId: item.branchId }, actor, { ...original, checkIn: item.requestedIn, checkOut: item.requestedOut, source: 'manual' }); }
    audit({ ...scope, branchId: item.branchId }, actor, `Correction ${status}`, item.attendanceId, item.employeeId, remarks);
  },
  leaveTypes: (tenantId: string) => leaveTypes.filter((row) => row.tenantId === tenantId),
  leaves: (scope: HrScope, branchId?: string) => visible(leaves, scope, branchId),
  leaveBalance(scope: HrScope, employeeId: string, typeId: string, year = new Date().getFullYear()) {
    employee(scope, employeeId);
    const type = leaveTypes.find((row) => row.id === typeId && row.tenantId === scope.tenantId);
    if (!type) throw new Error('Leave type not found.');
    const used = leaves.filter((row) => row.tenantId === scope.tenantId && row.employeeId === employeeId && row.typeId === typeId && row.status === 'approved' && row.startDate.startsWith(String(year))).reduce((sum, row) => sum + row.days, 0);
    return Math.max(0, type.annualDays - used);
  },
  requestLeave(scope: HrScope, actor: HrActor, input: Pick<Leave, 'employeeId' | 'typeId' | 'startDate' | 'endDate' | 'reason' | 'attachment'>) {
    const worker = employee(scope, input.employeeId);
    const count = days(input.startDate, input.endDate);
    if (!input.reason.trim() || !Number.isFinite(count) || count <= 0 || count > 366) throw new Error('Enter valid leave dates and a reason.');
    if (count > this.leaveBalance(scope, input.employeeId, input.typeId, Number(input.startDate.slice(0, 4)))) throw new Error('Leave request exceeds the available balance.');
    const item: Leave = { ...input, id: uid('leave'), tenantId: scope.tenantId, branchId: worker.branchId, days: count, status: 'pending' };
    leaves.unshift(item); audit({ ...scope, branchId: item.branchId }, actor, 'Leave requested', item.startDate, item.employeeId); return item;
  },
  decideLeave(scope: HrScope, actor: HrActor, id: string, status: 'approved' | 'rejected' | 'cancelled', remarks = '') {
    const item = leaves.find((row) => row.id === id && row.tenantId === scope.tenantId && permitted(scope, row.branchId));
    if (!item || (item.status !== 'pending' && !(item.status === 'approved' && status === 'cancelled'))) throw new Error('Leave status change is not allowed.');
    if (status === 'approved' && item.days > this.leaveBalance(scope, item.employeeId, item.typeId, Number(item.startDate.slice(0, 4)))) throw new Error('Insufficient leave balance.');
    item.status = status; item.remarks = remarks;
    if (status === 'approved') for (let offset = 0; offset < item.days; offset++) {
      const date = new Date(`${item.startDate}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + offset); const day = date.toISOString().slice(0, 10);
      if (!attendance.some((row) => row.tenantId === scope.tenantId && row.employeeId === item.employeeId && row.date === day)) attendance.unshift({ id: uid('att-leave'), tenantId: scope.tenantId, branchId: item.branchId, employeeId: item.employeeId, date: day, status: 'on_leave', overtimeHours: 0, source: 'leave', leaveId: item.id });
    }
    if (status === 'cancelled') for (let index = attendance.length - 1; index >= 0; index--) if (attendance[index].tenantId === scope.tenantId && attendance[index].leaveId === item.id) attendance.splice(index, 1);
    audit({ ...scope, branchId: item.branchId }, actor, `Leave ${status}`, item.startDate, item.employeeId, remarks); return item;
  },
  holidays: (scope: HrScope, branchId?: string) => holidays.filter((row) => row.tenantId === scope.tenantId && (!row.branchId || permitted(scope, row.branchId)) && (!branchId || !row.branchId || row.branchId === branchId)),
  addHoliday(scope: HrScope, actor: HrActor, input: Omit<Holiday, 'id' | 'tenantId'>) { if (input.branchId) assertBranch(scope, input.branchId); if (!input.date || !input.name.trim()) throw new Error('Date and holiday name are required.'); const item = { ...input, id: uid('holiday'), tenantId: scope.tenantId }; holidays.unshift(item); audit(scope, actor, 'Holiday created', item.name); return item; },
  overtime: (scope: HrScope, branchId?: string) => visible(overtime, scope, branchId),
  requestOvertime(scope: HrScope, actor: HrActor, input: Pick<Overtime, 'employeeId' | 'date' | 'hours'>) { const worker = employee(scope, input.employeeId); if (!input.date || !Number.isFinite(input.hours) || input.hours <= 0 || input.hours > 24) throw new Error('Enter valid overtime date and hours.'); const item: Overtime = { ...input, id: uid('ot'), tenantId: scope.tenantId, branchId: worker.branchId, status: 'pending' }; overtime.unshift(item); audit({ ...scope, branchId: item.branchId }, actor, 'Overtime requested', item.date, item.employeeId); return item; },
  decideOvertime(scope: HrScope, actor: HrActor, id: string, status: 'approved' | 'rejected', remarks = '') { const item = overtime.find((row) => row.id === id && row.tenantId === scope.tenantId && permitted(scope, row.branchId)); if (!item || item.status !== 'pending') throw new Error('Overtime is not pending.'); item.status = status; item.remarks = remarks; audit({ ...scope, branchId: item.branchId }, actor, `Overtime ${status}`, item.date, item.employeeId); return item; },
  payItems: (scope: HrScope, branchId?: string) => visible(payItems, scope, branchId),
  addPayItem(scope: HrScope, actor: HrActor, input: Pick<PayItem, 'employeeId' | 'kind' | 'name' | 'amount'>) { const worker = employee(scope, input.employeeId); if (!input.name.trim() || !Number.isFinite(input.amount) || input.amount < 0) throw new Error('Name and non-negative amount are required.'); const item: PayItem = { ...input, id: uid('payitem'), tenantId: scope.tenantId, branchId: worker.branchId, active: true }; payItems.unshift(item); audit({ ...scope, branchId: item.branchId }, actor, `${item.kind} assigned`, item.name, item.employeeId); return item; },
  revisions: (scope: HrScope, branchId?: string) => visible(revisions, scope, branchId),
  requestRevision(scope: HrScope, actor: HrActor, input: Pick<SalaryRevision, 'employeeId' | 'effectiveDate' | 'amount'>) { const worker = employee(scope, input.employeeId); if (!input.effectiveDate || !Number.isFinite(input.amount) || input.amount < 0) throw new Error('Enter a valid effective date and salary.'); const item: SalaryRevision = { ...input, id: uid('salary'), tenantId: scope.tenantId, branchId: worker.branchId, status: 'pending' }; revisions.unshift(item); audit({ ...scope, branchId: item.branchId }, actor, 'Salary revision requested', input.effectiveDate, input.employeeId); return item; },
  decideRevision(scope: HrScope, actor: HrActor, id: string, status: 'approved' | 'rejected') { const item = revisions.find((row) => row.id === id && row.tenantId === scope.tenantId && permitted(scope, row.branchId)); if (!item || item.status !== 'pending') throw new Error('Revision is not pending.'); item.status = status; audit({ ...scope, branchId: item.branchId }, actor, `Salary revision ${status}`, item.effectiveDate, item.employeeId); return item; },
  loans: (scope: HrScope, branchId?: string) => visible(loans, scope, branchId),
  requestLoan(scope: HrScope, actor: HrActor, input: Pick<Loan, 'employeeId' | 'type' | 'amount' | 'installments'>) { const worker = employee(scope, input.employeeId); if (!input.type.trim() || !Number.isFinite(input.amount) || input.amount <= 0 || !Number.isInteger(input.installments) || input.installments <= 0) throw new Error('Enter a loan type, positive amount and installments.'); const item: Loan = { ...input, id: uid('loan'), tenantId: scope.tenantId, branchId: worker.branchId, outstanding: input.amount, status: 'pending' }; loans.unshift(item); audit({ ...scope, branchId: item.branchId }, actor, 'Loan requested', item.type, item.employeeId); return item; },
  decideLoan(scope: HrScope, actor: HrActor, id: string, status: 'approved' | 'rejected') { const item = loans.find((row) => row.id === id && row.tenantId === scope.tenantId && permitted(scope, row.branchId)); if (!item || item.status !== 'pending') throw new Error('Loan is not pending.'); item.status = status; audit({ ...scope, branchId: item.branchId }, actor, `Loan ${status}`, item.type, item.employeeId); return item; },
  payrolls: (scope: HrScope, branchId?: string) => visible(payrolls, scope, branchId),
  commissionCandidates(scope: HrScope, period: string, branchId?: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Period must be YYYY-MM.');
    return salesStore.payments().filter(payment => payment.tenantId === scope.tenantId && permitted(scope, payment.branchId) && (!branchId || payment.branchId === branchId) && payment.paymentDate.startsWith(period) && payment.amount > 0).flatMap(payment => {
      const invoice = salesStore.invoices().find(row => row.id === payment.invoiceId && row.tenantId === scope.tenantId && row.branchId === payment.branchId && row.status !== 'void');
      if (!invoice?.salespersonId) return [];
      return [{ paymentId: payment.id, invoiceId: invoice.id, branchId: payment.branchId, period, reference: payment.referenceNumber, salespersonId: invoice.salespersonId, salespersonName: invoice.salespersonName, currency: invoice.currency, collectedAmount: payment.amount, rate: 2.5, amount: round(payment.amount * 0.025), handoff: commissions.find(row => row.tenantId === scope.tenantId && row.paymentId === payment.id) }];
    });
  },
  commissions: (scope: HrScope, branchId?: string) => visible(commissions, scope, branchId),
  prepareCommission(scope: HrScope, actor: HrActor, paymentId: string, employeeId: string) {
    const candidate = salesStore.payments().find(payment => payment.id === paymentId && payment.tenantId === scope.tenantId && permitted(scope, payment.branchId));
    if (!candidate) throw new Error('Collected payment is unavailable in your branches.');
    const source = this.commissionCandidates(scope, candidate.paymentDate.slice(0, 7), candidate.branchId).find(row => row.paymentId === paymentId);
    if (!source) throw new Error('This payment is not eligible for commission.');
    const worker = employee(scope, employeeId);
    if (worker.branchId !== source.branchId || worker.status !== 'active') throw new Error('Choose an active employee in the payment branch.');
    if (worker.currency !== source.currency) throw new Error('Employee and sales invoice currencies must match before commission enters payroll.');
    if (commissions.some(row => row.tenantId === scope.tenantId && row.paymentId === paymentId)) throw new Error('This payment already has a commission handoff.');
    if (payrolls.some(row => row.tenantId === scope.tenantId && row.branchId === source.branchId && row.period === source.period)) throw new Error('Payroll already exists for this branch and period.');
    const item: CommissionInput = { id: uid('commission'), tenantId: scope.tenantId, branchId: source.branchId, period: source.period, paymentId, invoiceId: source.invoiceId, salespersonId: source.salespersonId, employeeId, collectedAmount: source.collectedAmount, rate: source.rate, amount: source.amount, status: 'pending', preparedAt: new Date().toISOString() };
    commissions.unshift(item); audit({ ...scope, branchId: item.branchId }, actor, 'Commission prepared', source.reference, employeeId); return item;
  },
  decideCommission(scope: HrScope, actor: HrActor, id: string, status: 'approved' | 'rejected') {
    const item = commissions.find(row => row.id === id && row.tenantId === scope.tenantId && permitted(scope, row.branchId));
    if (!item || item.status !== 'pending') throw new Error('Only pending commissions can be reviewed.');
    if (payrolls.some(row => row.tenantId === scope.tenantId && row.branchId === item.branchId && row.period === item.period)) throw new Error('Payroll already exists for this branch and period.');
    item.status = status; item.reviewedAt = new Date().toISOString(); item.reviewedBy = actor.name;
    audit({ ...scope, branchId: item.branchId }, actor, `Commission ${status}`, item.paymentId, item.employeeId); return item;
  },
  preparePayroll(scope: HrScope, actor: HrActor, period: string, branchId: string) {
    assertBranch(scope, branchId);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Period must be YYYY-MM.');
    if (payrolls.some((row) => row.tenantId === scope.tenantId && row.branchId === branchId && row.period === period)) throw new Error('Payroll already exists for this period and branch.');
    if (commissions.some(row => row.tenantId === scope.tenantId && row.branchId === branchId && row.period === period && row.status === 'pending')) throw new Error('Review pending sales commissions before preparing payroll.');
    if (commissions.some(row => row.tenantId === scope.tenantId && row.branchId === branchId && row.period === period && row.status === 'approved' && !employees.some(worker => worker.id === row.employeeId && worker.tenantId === scope.tenantId && worker.branchId === branchId && (worker.status === 'active' || worker.status === 'on_leave')))) throw new Error('An approved commission belongs to an employee outside this payroll.');
    const lines = visible(employees, scope, branchId).filter((row) => row.status === 'active' || row.status === 'on_leave').map((worker): PayrollLine => {
      const revision = revisions.filter((row) => row.employeeId === worker.id && row.tenantId === scope.tenantId && row.status === 'approved' && row.effectiveDate <= `${period}-31`).sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
      const base = revision?.amount ?? worker.salary;
      const allowance = payItems.filter((row) => row.employeeId === worker.id && row.tenantId === scope.tenantId && row.active && row.kind === 'allowance').reduce((sum, row) => sum + row.amount, 0);
      const deduction = payItems.filter((row) => row.employeeId === worker.id && row.tenantId === scope.tenantId && row.active && row.kind === 'deduction').reduce((sum, row) => sum + row.amount, 0);
      const overtimeAmount = overtime.filter((row) => row.employeeId === worker.id && row.tenantId === scope.tenantId && row.status === 'approved' && row.date.startsWith(period)).reduce((sum, row) => sum + row.hours * base / 160, 0);
      const proposedRecovery = loans.filter((row) => row.employeeId === worker.id && row.tenantId === scope.tenantId && row.status === 'approved' && row.outstanding > 0).reduce((sum, row) => sum + Math.min(row.outstanding, round(row.amount / row.installments)), 0);
      const commission = round(commissions.filter(row => row.tenantId === scope.tenantId && row.branchId === branchId && row.period === period && row.employeeId === worker.id && row.status === 'approved' && !row.payrollId).reduce((sum, row) => sum + row.amount, 0));
      const gross = round(base + allowance + overtimeAmount + commission);
      const contributions = calculateStatutoryContributions(base, allowance, commission);
      if (deduction + contributions.employeeEpf > gross) throw new Error(`Deductions and EPF exceed gross pay for ${worker.employeeCode}.`);
      const loanRecovery = round(Math.min(proposedRecovery, gross - deduction - contributions.employeeEpf));
      return { employeeId: worker.id, base, allowance, overtime: round(overtimeAmount), commission, deduction, loanRecovery, ...contributions, gross, net: round(gross - deduction - contributions.employeeEpf - loanRecovery) };
    });
    const item: Payroll = { id: uid('payroll'), tenantId: scope.tenantId, branchId, period, status: 'draft', lines, createdAt: new Date().toISOString() };
    payrolls.unshift(item);
    for (const commission of commissions.filter(row => row.tenantId === scope.tenantId && row.branchId === branchId && row.period === period && row.status === 'approved' && !row.payrollId)) commission.payrollId = item.id;
    audit({ ...scope, branchId }, actor, 'Payroll prepared', period); return item;
  },
  changePayrollStatus(scope: HrScope, actor: HrActor, id: string, status: 'review' | 'approved') {
    const item = payrolls.find((row) => row.id === id && row.tenantId === scope.tenantId && permitted(scope, row.branchId));
    if (!item || (status === 'review' && item.status !== 'draft') || (status === 'approved' && item.status !== 'review')) throw new Error('Payroll status change is not allowed.');
    item.status = status;
    if (status === 'approved') { item.approvedAt = new Date().toISOString(); for (const line of item.lines) { let remaining = line.loanRecovery; for (const loan of loans.filter((row) => row.employeeId === line.employeeId && row.tenantId === scope.tenantId && row.status === 'approved' && row.outstanding > 0)) { const recovery = Math.min(remaining, loan.outstanding, round(loan.amount / loan.installments)); loan.outstanding = round(loan.outstanding - recovery); remaining = round(remaining - recovery); if (loan.outstanding === 0) loan.status = 'repaid'; } } }
    audit({ ...scope, branchId: item.branchId }, actor, `Payroll ${status}`, item.period); return item;
  },
  payslips(scope: HrScope, branchId?: string) { return visible(payrolls, scope, branchId).filter((row) => row.status === 'approved').flatMap((batch) => batch.lines.map((line) => ({ id: `${batch.id}-${line.employeeId}`, tenantId: batch.tenantId, branchId: batch.branchId, period: batch.period, status: 'ready' as const, ...line }))); },
  payrollHandoffs(scope: HrScope) { return visible(payrolls, scope).filter((row) => row.status === 'approved').map((row) => { const sum = (key: keyof PayrollLine) => round(row.lines.reduce((total, line) => total + Number(line[key]), 0)); const gross = sum('gross'), employerEpf = sum('employerEpf'), employerEtf = sum('employerEtf'); return { id: row.id, reference: `PAYROLL-${row.period}-${row.branchId}`, period: row.period, branchId: row.branchId, employeeCount: row.lines.length, gross, net: sum('net'), commission: sum('commission'), employeeEpf: sum('employeeEpf'), employerEpf, employerEtf, deductions: sum('deduction'), loanRecovery: sum('loanRecovery'), totalEmployerCost: round(gross + employerEpf + employerEtf), approvedAt: row.approvedAt, status: 'pending_accounting_mapping' as const }; }); },
  documents: (scope: HrScope, employeeId: string): DocumentRecord[] => { employee(scope, employeeId); return documentService.linkedPublic(scope, 'Employee', employeeId); },
  async addDocument(scope: HrScope, actor: HrActor, employeeId: string, file: File, category: string, expiryDate?: string, permissions: readonly string[] = []) { const worker = employee(scope, employeeId); const item = await documentService.upload(scope, permissions, actor, file, { title: file.name.replace(/\.[^.]+$/, ''), category, entityType: 'Employee', entityId: worker.id, entityReference: worker.employeeCode, branchId: worker.branchId, expiryDate }); audit({ ...scope, branchId: worker.branchId }, actor, 'Employee document uploaded', file.name, worker.id); return item; },
  audit: (scope: HrScope, employeeId?: string) => visible(auditLog, scope).filter((row) => !employeeId || row.employeeId === employeeId),
  dashboard(scope: HrScope, branchId?: string, departmentId?: string) { const workers = visible(employees, scope, branchId).filter((row) => !departmentId || row.departmentId === departmentId); const ids = new Set(workers.map((row) => row.id)); const todayAttendance = visible(attendance, scope, branchId).filter((row) => ids.has(row.employeeId) && row.date === today()); return { total: workers.length, active: workers.filter((row) => row.status === 'active').length, present: todayAttendance.filter((row) => ['present', 'late', 'early_leave'].includes(row.status)).length, absentLate: todayAttendance.filter((row) => row.status === 'absent' || row.status === 'late').length, pendingLeave: visible(leaves, scope, branchId).filter((row) => ids.has(row.employeeId) && row.status === 'pending').length, upcomingPayroll: visible(payrolls, scope, branchId).filter((row) => row.status !== 'approved').length }; },
  biometricPreview(scope: HrScope, csv: string): BiometricRow[] { const lines = csv.trim().split(/\r?\n/).slice(1); return lines.map((line, index) => { const [employeeCode = '', date = '', checkIn = '', checkOut = ''] = line.split(',').map((cell) => cell.trim()); const worker = visible(employees, scope).find((row) => row.employeeCode === employeeCode); const error = !worker ? 'Employee code not found in permitted branches.' : !/^\d{4}-\d{2}-\d{2}$/.test(date) ? 'Invalid date.' : !/^\d{2}:\d{2}$/.test(checkIn) || !/^\d{2}:\d{2}$/.test(checkOut) || hours(checkIn, checkOut) <= 0 ? 'Missing or invalid clock times.' : attendance.some((row) => row.tenantId === scope.tenantId && row.employeeId === worker.id && row.date === date) ? 'Attendance already recorded.' : undefined; return { row: index + 2, employeeCode, date, checkIn, checkOut, status: error ? 'exception' : 'valid', error }; }); },
  importBiometric(scope: HrScope, actor: HrActor, rows: BiometricRow[]) { let imported = 0; for (const row of rows.filter((item) => item.status === 'valid')) { const worker = visible(employees, scope).find((item) => item.employeeCode === row.employeeCode); if (worker) { this.recordAttendance({ ...scope, branchId: worker.branchId }, actor, { branchId: worker.branchId, employeeId: worker.id, date: row.date, checkIn: row.checkIn, checkOut: row.checkOut, source: 'biometric' }); imported++; } } return imported; },
};

// Backend persistence registration (see src/core/persistence).
registerList('hr.employees', () => employees, (rows) => { employees = rows; });
registerList('hr.shifts', () => shifts, (rows) => replaceArray(shifts, rows));
registerList('hr.rosters', () => rosters, (rows) => replaceArray(rosters, rows));
registerList('hr.attendance', () => attendance, (rows) => replaceArray(attendance, rows));
registerList('hr.corrections', () => corrections, (rows) => replaceArray(corrections, rows));
registerList('hr.leaveTypes', () => leaveTypes, (rows) => replaceArray(leaveTypes, rows));
registerList('hr.leaves', () => leaves, (rows) => replaceArray(leaves, rows));
registerList('hr.holidays', () => holidays, (rows) => replaceArray(holidays, rows));
registerList('hr.overtime', () => overtime, (rows) => replaceArray(overtime, rows));
registerList('hr.payItems', () => payItems, (rows) => replaceArray(payItems, rows));
registerList('hr.revisions', () => revisions, (rows) => replaceArray(revisions, rows));
registerList('hr.loans', () => loans, (rows) => replaceArray(loans, rows));
registerList('hr.payrolls', () => payrolls, (rows) => replaceArray(payrolls, rows));
registerList('hr.commissions', () => commissions, (rows) => replaceArray(commissions, rows));
registerList('hr.audit', () => auditLog, (rows) => replaceArray(auditLog, rows));
