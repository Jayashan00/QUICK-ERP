import type { DocumentRecord } from '@/shared/types/document-record';

export const mockDocuments: DocumentRecord[] = [
  { id: 'document-001', name: 'Master Service Agreement.pdf', category: 'contract', mimeType: 'application/pdf', sizeBytes: 284160, uploadedAt: '2026-09-20T09:30:00Z', uploadedBy: 'Admin User', expiryDate: '2027-09-20', entityType: 'Customer', entityId: 'cust-001', entityReference: 'CUST-0001' },
  { id: 'document-002', name: 'Tax Registration.pdf', category: 'finance', mimeType: 'application/pdf', sizeBytes: 92160, uploadedAt: '2026-09-18T11:15:00Z', uploadedBy: 'Accountant', entityType: 'Supplier', entityId: 'sup-001', entityReference: 'SUP-0001' },
];
