import { auditEventService, type AuditAccessScope } from '../src/core/audit';

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(`Audit QA failed: ${message}`); };
const scope: AuditAccessScope = { tenantId: 'tenant-001', permittedBranchIds: ['branch-001'], canView: true, canExport: true, canViewSensitive: true, canViewSecurity: true };

const initial = await auditEventService.list(scope, { pageSize: 100 });
assert(initial.data.length > 0, 'scoped audit list must not be empty');
assert(initial.data.every((event) => event.tenantId === scope.tenantId), 'tenant isolation must be enforced');
assert(initial.data.every((event) => !event.branchId || scope.permittedBranchIds.includes(event.branchId)), 'branch restrictions must be enforced');
assert(initial.data.some((event) => event.sensitivity === 'security'), 'security events must be visible with permission');
assert(initial.data.some((event) => event.sensitivity === 'sensitive'), 'sensitive events must be visible with permission');

const restricted = await auditEventService.list({ ...scope, canViewSensitive: false, canViewSecurity: false }, { pageSize: 100 });
assert(restricted.data.every((event) => event.sensitivity === 'normal'), 'restricted users must not receive sensitive or security events');

const values = { status: 'draft' };
const created = auditEventService.record({ tenantId: 'tenant-001', branchId: 'branch-001', actorId: 'qa-user', actorName: 'QA User', module: 'inventory', entityType: 'Stock Count', entityId: 'qa-count', reference: 'COUNT-QA-001', action: 'Approved', description: 'QA variance approval event.', previousValues: values, newValues: { status: 'completed' }, remarks: 'QA approval', relatedRoute: '/inventory/counts' });
values.status = 'mutated-outside';
created.previousValues = { status: 'mutated-return' };
const recorded = (await auditEventService.list(scope, { search: 'COUNT-QA-001', pageSize: 10 })).data[0];
assert(recorded?.previousValues?.status === 'draft', 'stored audit snapshots must be isolated from caller mutations');
assert(recorded?.newValues?.status === 'completed', 'before and after values must be preserved');
assert(recorded?.remarks === 'QA approval', 'remarks must be preserved');

const branchFiltered = await auditEventService.list({ ...scope, permittedBranchIds: ['branch-002'] }, { branchId: 'branch-002', pageSize: 100 });
assert(branchFiltered.data.every((event) => event.branchId === 'branch-002'), 'branch filters must only return the requested permitted branch');
const exported = await auditEventService.listForExport(scope, { search: 'COUNT-QA-001' });
assert(exported.length === 1 && exported[0]?.id === created.id, 'export must respect current search and scope');

let viewBlocked = false;
try { await auditEventService.list({ ...scope, canView: false }); } catch { viewBlocked = true; }
assert(viewBlocked, 'audit.view must be enforced by the service');
let exportBlocked = false;
try { await auditEventService.listForExport({ ...scope, canExport: false }); } catch { exportBlocked = true; }
assert(exportBlocked, 'audit.export must be enforced by the service');

console.log('Audit QA passed: event creation, immutable snapshots, tenant/branch scope, filters, sensitive/security RBAC, and export RBAC.');
