import assert from 'node:assert/strict';
import { advancedHrService as hr } from '../src/features/hr/advancedHrService';
import { hrService, type HrScope } from '../src/features/hr/hrService';
import { TENANT_PERMISSIONS as P } from '../src/core/permissions/tenantPermissionConstants';
import { hasPermission } from '../src/core/permissions/permissionUtils';

const scope: HrScope = { tenantId: 'tenant-001', branchId: 'branch-001', permittedBranchIds: ['branch-001'] };
const actor = { id: 'qa', name: 'HR QA' };
assert.equal(hasPermission([P.HR.RECRUITMENT_VIEW], P.HR.RECRUITMENT_EDIT), false);
assert.equal(hr.candidates({ ...scope, tenantId: 'other' }).length, 0);
assert.equal(hr.candidates({ ...scope, branchId: 'branch-002', permittedBranchIds: ['branch-002'] }).length, 0);
assert.throws(() => hr.addJob(scope, actor, { branchId: 'branch-002', title: 'Wrong branch', departmentId: 'dept-001', designationId: 'des-005', closesOn: '2026-11-30' }));
const job = hr.addJob(scope, actor, { branchId: scope.branchId, title: 'QA recruit', departmentId: 'dept-001', designationId: 'des-005', closesOn: '2026-11-30' });
const candidate = hr.addCandidate(scope, actor, { jobId: job.id, name: 'QA Recruit', email: 'recruit@qa.test', appliedOn: '2026-10-01' });
assert.throws(() => hr.setCandidateStage(scope, actor, candidate.id, 'interview', 'bad-date'));
hr.setCandidateStage(scope, actor, candidate.id, 'interview', '2026-10-10');
hr.setCandidateStage(scope, actor, candidate.id, 'shortlisted');
hr.setCandidateStage(scope, actor, candidate.id, 'selected');
const todayStr = new Date().toISOString().slice(0, 10);
const employee = await hr.convertCandidate(scope, actor, candidate.id, { employeeCode: 'QA-ADV-001', phone: '123456789', salary: 3000, dateOfJoining: todayStr });
assert.equal(hrService.employee(scope, employee.id).employeeCode, 'QA-ADV-001');
assert.equal(hr.onboardings(scope).find((row) => row.employeeId === employee.id)?.status, 'open');
const onboarding = hr.onboardings(scope).find((row) => row.employeeId === employee.id)!;
for (let index = 0; index < onboarding.tasks.length; index++) hr.setOnboardingTask(scope, actor, onboarding.id, index, true);
assert.equal(onboarding.status, 'complete');
const training = hr.addTraining(scope, actor, { employeeId: employee.id, title: 'Safety', startsOn: '2026-10-16', endsOn: '2026-10-17' });
hr.completeTraining(scope, actor, training.id, 'Passed', 'CERT-001');
const review = hr.addReview(scope, actor, { employeeId: employee.id, reviewerId: 'emp-001', period: '2026-10', goals: 'Complete induction' });
assert.throws(() => hr.submitReview(scope, actor, review.id, 6, 'Invalid'));
hr.submitReview(scope, actor, review.id, 4, 'On track'); hr.completeReview(scope, actor, review.id);
const okr = hr.addOkr(scope, actor, { employeeId: employee.id, objective: 'Onboard', keyResult: 'Finish tasks', period: '2026-10' });
assert.throws(() => hr.setOkrProgress(scope, actor, okr.id, 101)); hr.setOkrProgress(scope, actor, okr.id, 100);
const policy = hr.addPolicy(scope, actor, { branchId: scope.branchId, title: 'QA policy', category: 'Conduct', version: '1', effectiveOn: '2026-10-01', document: 'qa.pdf' });
hr.acknowledgePolicy(scope, actor, policy.id, employee.id); assert.throws(() => hr.acknowledgePolicy(scope, actor, policy.id, employee.id));
const ticket = hr.addTicket(scope, actor, { employeeId: employee.id, category: 'General', priority: 'normal', subject: 'Help', attachment: '' });
hr.commentTicket(scope, actor, ticket.id, 'Answered'); hr.updateTicket(scope, actor, ticket.id, 'closed');
const asset = hr.issueAsset(scope, actor, { employeeId: employee.id, name: 'Laptop QA', issuedOn: '2026-10-15', condition: 'Good' });
const exit = hr.startExit(scope, actor, { employeeId: employee.id, type: 'resignation', lastDay: '2026-11-30', reason: 'QA' });
await assert.rejects(() => hr.completeExit(scope, actor, exit.id));
for (let index = 0; index < exit.clearance.length; index++) hr.setExitTask(scope, actor, exit.id, index, true);
await assert.rejects(() => hr.completeExit(scope, actor, exit.id));
hr.returnAsset(scope, actor, asset.id, '2026-11-30', 'Good'); await hr.completeExit(scope, actor, exit.id);
assert.equal(hrService.employee(scope, employee.id).status, 'resigned');
assert.ok(hr.audit(scope).some((row) => row.action === 'Exit completed'));

// Validate restricting job opening on a previous date
assert.throws(() => hr.addJob(scope, actor, { branchId: scope.branchId, title: 'Old job', departmentId: 'dept-001', designationId: 'des-005', openedOn: '2020-01-01', closesOn: '2026-11-30' }), /previous date/);

// Validate restricting interview date before job opening date
const jobWithDate = hr.addJob(scope, actor, { branchId: scope.branchId, title: 'Dated job', departmentId: 'dept-001', designationId: 'des-005', openedOn: '2026-11-20', closesOn: '2026-11-30' });
const cand = hr.addCandidate(scope, actor, { jobId: jobWithDate.id, name: 'Date cand', email: 'dc@qa.test', appliedOn: '2026-11-20' });
assert.throws(() => hr.setCandidateStage(scope, actor, cand.id, 'interview', '2026-11-19'), /on or after the job opening date/);

// Validate preventing same employee from being selected as both Employee and Reviewer
assert.throws(() => hr.addReview(scope, actor, { employeeId: employee.id, reviewerId: employee.id, period: '2026-11', goals: 'Self review' }), /cannot be the same person/);

// Validate preventing candidate joining date as past date
const candPast = hr.addCandidate(scope, actor, { jobId: jobWithDate.id, name: 'Past joining cand', email: 'pjc@qa.test', appliedOn: '2026-11-20' });
hr.setCandidateStage(scope, actor, candPast.id, 'interview', '2026-11-20');
hr.setCandidateStage(scope, actor, candPast.id, 'shortlisted');
hr.setCandidateStage(scope, actor, candPast.id, 'selected');
await assert.rejects(() => hr.convertCandidate(scope, actor, candPast.id, { employeeCode: 'QA-ADV-002', phone: '123456789', salary: 3000, dateOfJoining: '2020-01-01' }), /past date/);

// Validate preventing candidate to job opening after its closing date
const closingJob = hr.addJob(scope, actor, { branchId: scope.branchId, title: 'Closing job', departmentId: 'dept-001', designationId: 'des-005', openedOn: todayStr, closesOn: todayStr });
assert.throws(() => hr.addCandidate(scope, actor, { jobId: closingJob.id, name: 'Late Cand', email: 'late@qa.test', appliedOn: '2099-01-01' }), /after its closing date/);

// Validate preventing employee who is already resigned from submitting another resignation
assert.throws(() => hr.startExit(scope, actor, { employeeId: employee.id, type: 'resignation', lastDay: '2027-01-01', reason: 'Resign again' }), /already in Resigned status/);

console.log('Advanced HR recruitment, onboarding, training, review, OKR, policy, ticket, asset, exit, scope and permission checks passed.');
