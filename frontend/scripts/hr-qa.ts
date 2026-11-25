import assert from 'node:assert/strict';
import { calculateStatutoryContributions, hrService, type HrScope } from '../src/features/hr/hrService';
import { departmentService } from '../src/features/settings/organization/services/departmentService';
import { designationService } from '../src/features/settings/organization/services/designationService';
import { TENANT_PERMISSIONS } from '../src/core/permissions/tenantPermissionConstants';
import { hasPermission } from '../src/core/permissions/permissionUtils';
import { salesService } from '../src/features/sales/services/salesService';
import { generatePayslipHtml } from '../src/features/hr/components/PayslipDocumentModal';
import '../src/core/auth/userService';

const scope: HrScope = { tenantId: 'tenant-001', branchId: 'branch-001', permittedBranchIds: ['branch-001'] };
const other: HrScope = { tenantId: 'tenant-other', branchId: 'branch-001', permittedBranchIds: ['branch-001'] };
const actor = { id: 'qa', name: 'HR QA' };
assert.equal(hasPermission([TENANT_PERMISSIONS.HR.PAYROLL_VIEW], TENANT_PERMISSIONS.HR.PAYROLL_APPROVE), false);
assert.equal(hrService.employees(other).length, 0);
assert.ok(hrService.employees(scope).length > 0);
assert.equal(hrService.employees(scope).some((row) => /\badmin(?:istrator)?\b/i.test(row.roleName ?? '')), false);
const linkedManager = hrService.employees(scope).find((row) => row.userId === 'usr-002');
assert.equal(linkedManager?.roleName, 'Sales Manager');
assert.match(linkedManager?.employeeCode ?? '', /^EMP-\d{4}$/);
assert.ok(linkedManager);
const linkedManagerWithSalary = await hrService.saveEmployee(scope, actor, {
  ...linkedManager,
  departmentId: 'dept-001',
  designationId: 'des-005',
  salary: 125000,
});
assert.equal(linkedManagerWithSalary.salary, 125000);
assert.equal(linkedManagerWithSalary.userId, 'usr-002');
assert.equal(hrService.employee(scope, linkedManager.id).salary, 125000);
assert.equal(hrService.employees(scope).filter((row) => row.userId === 'usr-002').length, 1);
const linkedManagerUpdated = await hrService.saveEmployee(scope, actor, {
  ...linkedManagerWithSalary,
  firstName: 'Tampered',
  email: 'tampered@example.test',
  salary: 130000,
});
assert.equal(linkedManagerUpdated.firstName, linkedManager.firstName);
assert.equal(linkedManagerUpdated.email, linkedManager.email);
assert.equal(linkedManagerUpdated.salary, 130000);
assert.equal(new Set(hrService.employees(scope).map((row) => row.employeeCode)).size, hrService.employees(scope).length);
assert.ok(hrService.employees({ ...scope, branchId: 'branch-002', permittedBranchIds: ['branch-002'] }).every((row) => row.branchId === 'branch-002'));
assert.ok((await departmentService.getDepartmentById(scope.tenantId, 'dept-001')));
assert.ok((await designationService.getDesignationById(scope.tenantId, 'des-005')));
await assert.rejects(() => hrService.saveEmployee(scope, actor, { branchId: 'branch-002', employeeCode: 'QA-INVALID', firstName: 'A', lastName: 'B', email: 'a@b.test', phone: '1234567', departmentId: 'dept-001', designationId: 'des-005', employmentType: 'full_time', status: 'active', dateOfJoining: '2026-09-30', salary: 100, currency: 'USD' }));

const worker = await hrService.saveEmployee(scope, actor, { branchId: scope.branchId, firstName: 'QA', lastName: 'Worker', email: 'qa@work.test', phone: '123456789', departmentId: 'dept-001', designationId: 'des-005', employmentType: 'full_time', status: 'active', dateOfJoining: '2026-09-01', salary: 3000, currency: 'USD' });
assert.match(worker.employeeCode, /^EMP-\d{4}$/);
const shift = hrService.saveShift(scope, actor, { branchId: scope.branchId, name: 'QA day', start: '09:00', end: '17:00', breakMinutes: 60, active: true });
hrService.assignShift(scope, actor, { branchId: scope.branchId, employeeId: worker.id, shiftId: shift.id, date: '2026-09-29' });
const attendance = hrService.recordAttendance(scope, actor, { branchId: scope.branchId, employeeId: worker.id, date: '2026-09-29', checkIn: '09:15', checkOut: '17:30', source: 'manual' });
assert.equal(attendance.status, 'late');
const correction = hrService.requestCorrection(scope, actor, { attendanceId: attendance.id, requestedIn: '08:55', requestedOut: '17:30', reason: 'Device clock offset' });
hrService.decideCorrection(scope, actor, correction.id, 'approved', 'Verified');
assert.equal(hrService.attendance(scope).find((row) => row.id === attendance.id)?.status, 'present');
assert.throws(() => hrService.decideCorrection(scope, actor, correction.id, 'approved', 'Repeat'));
const invalid = hrService.biometricPreview(scope, 'employeeCode,date,checkIn,checkOut\nUNKNOWN,2026-09-30,09:00,17:00');
assert.equal(invalid[0].status, 'exception');

const balance = hrService.leaveBalance(scope, worker.id, 'leave-annual', 2026);
const leave = hrService.requestLeave(scope, actor, { employeeId: worker.id, typeId: 'leave-annual', startDate: '2026-10-01', endDate: '2026-10-02', reason: 'Personal leave' });
hrService.decideLeave(scope, actor, leave.id, 'approved');
assert.equal(hrService.leaveBalance(scope, worker.id, 'leave-annual', 2026), balance - 2);
assert.ok(hrService.attendance(scope).some((row) => row.leaveId === leave.id && row.status === 'on_leave'));
assert.throws(() => hrService.requestLeave(scope, actor, { employeeId: worker.id, typeId: 'leave-annual', startDate: '2026-10-01', endDate: '2026-11-30', reason: 'Too long' }));
const overtime = hrService.requestOvertime(scope, actor, { employeeId: worker.id, date: '2026-09-29', hours: 2 });
hrService.decideOvertime(scope, actor, overtime.id, 'approved');
hrService.addPayItem(scope, actor, { employeeId: worker.id, kind: 'allowance', name: 'Transport', amount: 100 });
hrService.addPayItem(scope, actor, { employeeId: worker.id, kind: 'deduction', name: 'Insurance', amount: 50 });
const loan = hrService.requestLoan(scope, actor, { employeeId: worker.id, type: 'Staff loan', amount: 600, installments: 6 });
hrService.decideLoan(scope, actor, loan.id, 'approved');
const commissionSource = hrService.commissionCandidates(scope, '2026-09', scope.branchId)[0];
assert.ok(commissionSource && commissionSource.amount > 0);
const commission = hrService.prepareCommission(scope, actor, commissionSource.paymentId, worker.id);
assert.throws(() => hrService.prepareCommission(scope, actor, commissionSource.paymentId, worker.id), /already/);
assert.throws(() => hrService.preparePayroll(scope, actor, '2026-09', scope.branchId), /pending sales commissions/);
hrService.decideCommission(scope, actor, commission.id, 'approved');
const payroll = hrService.preparePayroll(scope, actor, '2026-09', scope.branchId);
const line = payroll.lines.find((item) => item.employeeId === worker.id);
assert.ok(line);
assert.deepEqual(calculateStatutoryContributions(3000, 100, 0), { contributionBase: 3100, employeeEpf: 248, employerEpf: 372, employerEtf: 93 });
assert.equal(line.commission, commission.amount);
assert.equal(commission.payrollId, payroll.id);
assert.equal(line.contributionBase, line.base + line.allowance + line.commission);
assert.equal(line.employeeEpf, Math.round(line.contributionBase * 8) / 100);
assert.equal(line.employerEpf, Math.round(line.contributionBase * 12) / 100);
assert.equal(line.employerEtf, Math.round(line.contributionBase * 3) / 100);
assert.equal(line.net, Math.round((line.gross - line.deduction - line.employeeEpf - line.loanRecovery) * 100) / 100);
assert.throws(() => hrService.changePayrollStatus(scope, actor, payroll.id, 'approved'));
hrService.changePayrollStatus(scope, actor, payroll.id, 'review');
hrService.changePayrollStatus(scope, actor, payroll.id, 'approved');
assert.equal(hrService.payslips(scope).find((row) => row.employeeId === worker.id)?.employeeEpf, line.employeeEpf);
assert.ok(hrService.payrollHandoffs(scope).some((row) => row.id === payroll.id));
const handoff = hrService.payrollHandoffs(scope).find((row) => row.id === payroll.id)!;
assert.equal(handoff.totalEmployerCost, Math.round((handoff.gross + handoff.employerEpf + handoff.employerEtf) * 100) / 100);
assert.equal(handoff.commission, commission.amount);
assert.equal((await salesService.getCommissions(scope, scope.permittedBranchIds)).find(row => row.salespersonId === commission.salespersonId)?.payrollStatus, 'included');
assert.equal(hrService.payrollHandoffs(other).length, 0);
assert.ok(hrService.audit(scope, worker.id).length > 0);

// Validate alphanumeric phone rejection
await assert.rejects(() => hrService.saveEmployee(scope, actor, { branchId: scope.branchId, firstName: 'Invalid', lastName: 'Phone', email: 'inv@phone.test', phone: '0771234abc', departmentId: 'dept-001', designationId: 'des-005', employmentType: 'full_time', status: 'active', dateOfJoining: '2026-09-01', salary: 3000, currency: 'USD' }), /Phone number cannot contain letters/);

// Validate night shift addition
const nightShift = hrService.saveShift(scope, actor, { branchId: scope.branchId, name: 'Night shift', start: '22:00', end: '06:00', breakMinutes: 60, active: true });
assert.equal(nightShift.name, 'Night shift');

// Validate all employees have generated payslips
const allWorkers = hrService.employees(scope);
const allSlips = hrService.payslips(scope);
assert.ok(allWorkers.every((w) => allSlips.some((s) => s.employeeId === w.id)));
const brandedPayslipHtml = generatePayslipHtml({
  payslip: allSlips[0],
  employee: allWorkers.find((row) => row.id === allSlips[0].employeeId),
  companyName: 'Quick & Solutions',
  companyLogoUrl: 'data:image/png;base64,AAAA',
  formatMoney: (amount) => `LKR ${amount.toFixed(2)}`,
});
assert.match(brandedPayslipHtml, /Quick &amp; Solutions/);
assert.match(brandedPayslipHtml, /data:image\/png;base64,AAAA/);
assert.equal(brandedPayslipHtml.includes('Acme Corporation'), false);

// Validate send payslip email
const emailResult = hrService.sendPayslipEmail(scope, actor, allSlips[0].id);
assert.equal(emailResult.success, true);
assert.ok(emailResult.email);

// Validate attendance calculation considering shift (late & overtime)
const dayShift = hrService.saveShift(scope, actor, { branchId: scope.branchId, name: 'Standard shift', start: '09:00', end: '17:00', breakMinutes: 60, active: true });
const shiftAtt = hrService.recordAttendance(scope, actor, {
  branchId: scope.branchId,
  employeeId: worker.id,
  shiftId: dayShift.id,
  date: '2026-09-30',
  checkIn: '09:10',
  checkOut: '17:00',
  source: 'manual',
});
assert.equal(shiftAtt.status, 'late');
assert.equal(shiftAtt.overtimeHours, 0);

const otAtt = hrService.recordAttendance(scope, actor, {
  branchId: scope.branchId,
  employeeId: worker.id,
  shiftId: dayShift.id,
  date: '2026-10-03',
  checkIn: '09:00',
  checkOut: '19:00',
  source: 'manual',
});
assert.equal(otAtt.status, 'present');
assert.equal(otAtt.overtimeHours, 2);

// Validate preventing attendance marking for resigned employee after effective exit date
const resignedWorker = await hrService.saveEmployee(scope, actor, {
  branchId: scope.branchId,
  firstName: 'Resigned',
  lastName: 'Person',
  email: 'resigned@test.com',
  phone: '0771234567',
  departmentId: 'dept-001',
  designationId: 'des-005',
  employmentType: 'full_time',
  status: 'resigned',
  dateOfJoining: '2026-01-01',
  exitDate: '2026-06-30',
  salary: 2000,
  currency: 'USD',
});
assert.throws(
  () => hrService.recordAttendance(scope, actor, {
    branchId: scope.branchId,
    employeeId: resignedWorker.id,
    date: '2026-07-01',
    checkIn: '09:00',
    checkOut: '17:00',
    source: 'manual',
  }),
  /after their effective resignation date/
);

// Validate preventing leave applications for resigned and terminated employees
assert.throws(
  () => hrService.requestLeave(scope, actor, {
    employeeId: resignedWorker.id,
    typeId: 'leave-annual',
    startDate: '2026-05-01',
    endDate: '2026-05-02',
    reason: 'Resigned leave',
  }),
  /not allowed for resigned or terminated employees/
);

const terminatedWorker = await hrService.saveEmployee(scope, actor, {
  branchId: scope.branchId,
  firstName: 'Terminated',
  lastName: 'Worker',
  email: 'term@test.com',
  phone: '0777654321',
  departmentId: 'dept-001',
  designationId: 'des-005',
  employmentType: 'full_time',
  status: 'terminated',
  dateOfJoining: '2026-01-01',
  exitDate: '2026-05-31',
  salary: 2500,
  currency: 'USD',
});
assert.throws(
  () => hrService.requestLeave(scope, actor, {
    employeeId: terminatedWorker.id,
    typeId: 'leave-annual',
    startDate: '2026-04-01',
    endDate: '2026-04-02',
    reason: 'Terminated leave',
  }),
  /not allowed for resigned or terminated employees/
);

// Validate preventing multiple overlapping leaves for the same employee
const firstLeave = hrService.requestLeave(scope, actor, {
  employeeId: worker.id,
  typeId: 'leave-sick',
  startDate: '2026-11-10',
  endDate: '2026-11-12',
  reason: 'First leave',
});
assert.ok(firstLeave.id);
assert.throws(
  () => hrService.requestLeave(scope, actor, {
    employeeId: worker.id,
    typeId: 'leave-annual',
    startDate: '2026-11-11',
    endDate: '2026-11-15',
    reason: 'Overlapping leave',
  }),
  /overlaps with an existing leave/
);

// Validate payslips department filtering
const deptSlips = hrService.payslips(scope, undefined, 'dept-001');
assert.ok(deptSlips.length > 0);
assert.ok(deptSlips.every((slip) => {
  const emp = hrService.employees(scope).find((e) => e.id === slip.employeeId);
  return emp?.departmentId === 'dept-001';
}));

console.log('HR scope, organization, attendance, leave, overtime, payroll and handoff checks passed.');
