import { registerList } from '@/core/persistence/stateRegistry';
import type {
  Supplier,
  SupplierCategory,
  SupplierStatus,
  SupplierNote,
  CreateSupplierNoteInput,
  UpdateSupplierNoteInput,
  SupplierActivity,
  SupplierTransaction,
  SupplierBalanceSummary,
  SupplierStatementData,
  SupplierPerformanceSummary,
} from '@/features/suppliers/types/supplier';
import type { DocumentRecord } from '@/shared/types/document-record';
import { mockSuppliers } from '@/features/suppliers/mocks/suppliers';
import { mockDocuments } from '@/shared/mocks/documents';
import { documentService } from '@/features/documents/documentService';

let suppliersStore: Supplier[] = [...mockSuppliers];

/** Supplier history preview records, separate from the purchasing workflow document. */
export interface SupplierPurchaseHistoryOrder {
  id: string; tenantId: string; branchId: string; poNumber: string; supplierId: string; supplierName: string;
  orderDate: string; expectedDate: string; status: 'draft' | 'issued' | 'received' | 'partial' | 'cancelled';
  currency: string; items: { id: string; productId: string; productName: string; sku: string; unit: string; quantity: number; unitPrice: number; taxPercent: number; taxAmount: number; subtotal: number; total: number }[];
  subtotal: number; taxAmount: number; totalAmount: number; notes?: string; createdAt: string; updatedAt: string;
}

function createMockDocPreview(title: string, category: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750" viewBox="0 0 600 750">
    <rect width="100%" height="100%" fill="#f8fafc"/>
    <rect x="30" y="30" width="540" height="690" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
    <rect x="60" y="60" width="180" height="12" rx="4" fill="#0284c7"/>
    <text x="60" y="110" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="bold" fill="#0f172a">${title}</text>
    <text x="60" y="140" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="#64748b">Quick ERP · Supplier Document Verification System (${category})</text>
    <line x1="60" y1="165" x2="540" y2="165" stroke="#e2e8f0" stroke-width="1"/>
    <rect x="60" y="195" width="480" height="14" rx="3" fill="#f1f5f9"/>
    <rect x="60" y="225" width="440" height="14" rx="3" fill="#f1f5f9"/>
    <rect x="60" y="255" width="460" height="14" rx="3" fill="#f1f5f9"/>
    <rect x="60" y="285" width="380" height="14" rx="3" fill="#f1f5f9"/>
    <rect x="60" y="335" width="220" height="70" rx="6" fill="#f0fdf4" stroke="#bbf7d0" stroke-width="1"/>
    <text x="75" y="365" font-family="sans-serif" font-size="13" font-weight="bold" fill="#166534">VERIFIED &amp; AUDITED</text>
    <text x="75" y="385" font-family="sans-serif" font-size="11" fill="#15803d">Status: Active &amp; Valid</text>
    <rect x="60" y="440" width="480" height="14" rx="3" fill="#f1f5f9"/>
    <rect x="60" y="470" width="410" height="14" rx="3" fill="#f1f5f9"/>
    <rect x="60" y="500" width="430" height="14" rx="3" fill="#f1f5f9"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const initialSupplierDocs: DocumentRecord[] = [
  ...mockDocuments.filter((doc) => doc.entityType === 'Supplier'),
  {
    id: 'doc-sup-001-msa',
    name: 'Master Vendor Agreement 2024.pdf',
    category: 'contract',
    mimeType: 'application/pdf',
    sizeBytes: 420800,
    uploadedAt: '2024-03-01T10:00:00Z',
    uploadedBy: 'Robert Brown',
    expiryDate: '2027-03-01',
    entityType: 'Supplier',
    entityId: 'sup-001',
    entityReference: 'SUP-0001',
    previewUrl: createMockDocPreview('Master Vendor Agreement 2024', 'Contract'),
  },
  {
    id: 'doc-sup-001-bank',
    name: 'Bank Account Verification Letter.pdf',
    category: 'finance',
    mimeType: 'application/pdf',
    sizeBytes: 154200,
    uploadedAt: '2024-03-05T14:20:00Z',
    uploadedBy: 'Finance Operations',
    entityType: 'Supplier',
    entityId: 'sup-001',
    entityReference: 'SUP-0001',
    previewUrl: createMockDocPreview('Bank Account Verification Letter', 'Finance & Tax'),
  },
  {
    id: 'doc-sup-002-iso',
    name: 'ISO 9001-2015 Quality Certificate.pdf',
    category: 'identity',
    mimeType: 'application/pdf',
    sizeBytes: 312000,
    uploadedAt: '2024-02-15T08:30:00Z',
    uploadedBy: 'Quality Assurance',
    expiryDate: '2026-12-31',
    entityType: 'Supplier',
    entityId: 'sup-002',
    entityReference: 'SUP-0002',
    previewUrl: createMockDocPreview('ISO 9001-2015 Quality Certificate', 'Legal & Registration'),
  },
];

documentService.importLegacy('tenant-001', 'branch-001', initialSupplierDocs);

const initialSupplierNotes: SupplierNote[] = [
  {
    id: 'note-sup-001-1',
    tenantId: 'tenant-001',
    supplierId: 'sup-001',
    content:
      'Initial vendor qualification completed. Signed SLA specifies standard lead time of 5 business days with 99.2% on-time delivery commitment.',
    createdBy: 'Robert Brown (Procurement Lead)',
    createdAt: '2024-03-02T11:30:00Z',
    updatedAt: '2024-03-02T11:30:00Z',
  },
  {
    id: 'note-sup-001-2',
    tenantId: 'tenant-001',
    supplierId: 'sup-001',
    content:
      'Negotiated payment terms updated to 2/10 Net 30 with 2% early settlement discount. Bank account verification letter received and verified by accounts payable.',
    createdBy: 'Finance Operations',
    createdAt: '2024-03-06T09:15:00Z',
    updatedAt: '2024-03-06T09:15:00Z',
  },
  {
    id: 'note-sup-002-1',
    tenantId: 'tenant-001',
    supplierId: 'sup-002',
    content:
      'Annual ISO 9001 compliance audit completed with zero non-conformances. Quality assurance certification valid through December 2026.',
    createdBy: 'Quality Assurance',
    createdAt: '2024-02-16T14:45:00Z',
    updatedAt: '2024-02-16T14:45:00Z',
  },
  {
    id: 'note-sup-003-1',
    tenantId: 'tenant-001',
    supplierId: 'sup-003',
    content:
      'Preferred primary vendor for corrugated packaging and protective transit materials. Scheduled volume discount review for next quarter.',
    createdBy: 'Sarah Jenkins',
    createdAt: '2024-01-20T10:00:00Z',
    updatedAt: '2024-01-20T10:00:00Z',
  },
];

let supplierNotesStore: SupplierNote[] = [...initialSupplierNotes];


export interface GetSuppliersParams {
  search?: string;
  status?: SupplierStatus | 'all';
  category?: SupplierCategory | 'all';
  country?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface PaginatedSuppliersResult {
  data: Supplier[];
  total: number;
  page: number;
  pageSize: number;
}

export type CreateSupplierInput = Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>;

export const supplierService = {
  async getSuppliers(
    tenantId: string,
    params: GetSuppliersParams = {},
  ): Promise<PaginatedSuppliersResult> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    let filtered = suppliersStore.filter((s) => s.tenantId === tenantId);

    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.contactPerson.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.phone.includes(q) ||
          (s.mobile && s.mobile.includes(q)) ||
          (s.category && s.category.toLowerCase().includes(q)) ||
          (s.taxNumber && s.taxNumber.toLowerCase().includes(q)) ||
          (s.vatNumber && s.vatNumber.toLowerCase().includes(q)) ||
          (s.registrationNumber && s.registrationNumber.toLowerCase().includes(q)) ||
          (s.address.city && s.address.city.toLowerCase().includes(q)) ||
          (s.address.street && s.address.street.toLowerCase().includes(q)),
      );
    }

    if (params.status && params.status !== 'all') {
      filtered = filtered.filter((s) => s.status === params.status);
    }

    if (params.category && params.category !== 'all') {
      filtered = filtered.filter((s) => s.category === params.category);
    }

    if (params.country && params.country !== 'all') {
      filtered = filtered.filter((s) => s.address.country === params.country);
    }

    if (params.sortField) {
      const field = params.sortField;
      const order = params.sortOrder === 'desc' ? -1 : 1;
      filtered.sort((a, b) => {
        let valA: unknown;
        let valB: unknown;

        switch (field) {
          case 'name':
            valA = a.name;
            valB = b.name;
            break;
          case 'code':
            valA = a.code;
            valB = b.code;
            break;
          case 'category':
            valA = a.category ?? '';
            valB = b.category ?? '';
            break;
          case 'contactPerson':
            valA = a.contactPerson;
            valB = b.contactPerson;
            break;
          case 'status':
            valA = a.status;
            valB = b.status;
            break;
          case 'createdAt':
            valA = a.createdAt;
            valB = b.createdAt;
            break;
          case 'currency':
            valA = a.currency;
            valB = b.currency;
            break;
          default:
            valA = (a as unknown as Record<string, unknown>)[field];
            valB = (b as unknown as Record<string, unknown>)[field];
            break;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          return valA.localeCompare(valB) * order;
        }
        if (typeof valA === 'number' && typeof valB === 'number') {
          return (valA - valB) * order;
        }
        return 0;
      });
    }

    const total = filtered.length;
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (page - 1) * pageSize;

    return {
      data: filtered.slice(startIndex, startIndex + pageSize),
      total,
      page,
      pageSize,
    };
  },

  async getSupplierById(tenantId: string, id: string): Promise<Supplier | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return (
      suppliersStore.find((s) => s.id === id && s.tenantId === tenantId) ?? null
    );
  },

  async createSupplier(tenantId: string, data: CreateSupplierInput): Promise<Supplier> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const duplicate = suppliersStore.find(
      (s) => s.tenantId === tenantId && s.code === data.code,
    );
    if (duplicate) {
      throw new Error(`Supplier with code "${data.code}" already exists.`);
    }

    const now = new Date().toISOString();
    const newSupplier: Supplier = {
      ...data,
      id: crypto.randomUUID(),
      tenantId,
      createdAt: now,
      updatedAt: now,
    };
    suppliersStore = [newSupplier, ...suppliersStore];
    return newSupplier;
  },

  async updateSupplier(
    tenantId: string,
    id: string,
    data: Partial<Supplier>,
  ): Promise<Supplier> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const index = suppliersStore.findIndex(
      (s) => s.id === id && s.tenantId === tenantId,
    );
    if (index === -1) throw new Error('Supplier not found');

    const updated: Supplier = {
      ...suppliersStore[index],
      ...data,
      id: suppliersStore[index].id,
      tenantId: suppliersStore[index].tenantId,
      createdAt: suppliersStore[index].createdAt,
      updatedAt: new Date().toISOString(),
    };
    suppliersStore[index] = updated;
    return updated;
  },

  async deleteSupplier(tenantId: string, id: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const exists = suppliersStore.some(
      (s) => s.id === id && s.tenantId === tenantId,
    );
    if (!exists) throw new Error('Supplier not found');

    suppliersStore = suppliersStore.filter((s) => s.id !== id);
    return true;
  },

  async getSupplierDocuments(
    tenantId: string,
    supplierId: string,
    permittedBranchIds: string[] = ['branch-001'],
  ): Promise<DocumentRecord[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (!suppliersStore.some((supplier) => supplier.id === supplierId && supplier.tenantId === tenantId)) return [];
    return documentService.linkedPublic({ tenantId, branchId: permittedBranchIds[0] ?? '', permittedBranchIds }, 'Supplier', supplierId);
  },

  async uploadSupplierDocument(
    tenantId: string,
    supplierId: string,
    supplierCode: string,
    file: File,
    metadata: {
      category: string;
      expiryDate?: string;
      entityType?: string;
      entityReference?: string;
    },
    uploadedBy: string = 'Procurement Officer',
    branchId: string = 'branch-001',
    permittedBranchIds: string[] = [branchId],
    permissions: readonly string[] = [],
  ): Promise<DocumentRecord> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!suppliersStore.some((supplier) => supplier.id === supplierId && supplier.tenantId === tenantId)) throw new Error('Supplier not found');
    return documentService.upload({ tenantId, branchId, permittedBranchIds }, permissions, { id: uploadedBy, name: uploadedBy }, file, { title: file.name.replace(/\.[^.]+$/, ''), category: metadata.category || 'general', entityType: 'Supplier', entityId: supplierId, entityReference: supplierCode, branchId, expiryDate: metadata.expiryDate });
  },

  async deleteSupplierDocument(
    tenantId: string,
    supplierId: string,
    documentId: string,
    branchId: string = 'branch-001',
    permittedBranchIds: string[] = [branchId],
    permissions: readonly string[] = [],
  ): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const exists = suppliersStore.some((supplier) => supplier.id === supplierId && supplier.tenantId === tenantId);
    if (!exists) throw new Error('Document not found');
    const scope = { tenantId, branchId, permittedBranchIds };
    const document = documentService.get(scope, permissions, documentId);
    if (document.entityType !== 'Supplier' || document.entityId !== supplierId) throw new Error('Document not found for supplier.');
    documentService.archive(scope, permissions, { id: 'supplier-user', name: 'Supplier user' }, documentId);
    return true;
  },

  downloadSupplierDocument(document: DocumentRecord): void {
    let url: string;
    let cleanupNeeded = false;

    const storedUrl = document.previewUrl ?? document.url;
    if (storedUrl && (storedUrl.startsWith('blob:') || /^https?:\/\//.test(storedUrl))) {
      url = storedUrl;
    } else {
      // Generate a downloadable representation for the mock document
      const blobContent = `--- QUICK ERP MOCK ATTACHMENT ---\nDocument: ${document.name}\nCategory: ${document.category}\nEntity: ${document.entityType ?? 'Supplier'} (${document.entityReference ?? ''})\nUploaded By: ${document.uploadedBy}\nUploaded At: ${document.uploadedAt}\nSize: ${document.sizeBytes} bytes\nStatus: Verified Quick ERP Mock Attachment\n`;
      const blob = new Blob([blobContent], { type: document.mimeType || 'text/plain' });
      url = URL.createObjectURL(blob);
      cleanupNeeded = true;
    }

    const link = window.document.createElement('a');
    link.href = url;
    link.download = document.name;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);

    if (cleanupNeeded) {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  },

  async getSupplierNotes(
    tenantId: string,
    supplierId: string,
  ): Promise<SupplierNote[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return supplierNotesStore
      .filter(
        (n) =>
          n.supplierId === supplierId &&
          n.tenantId === tenantId,
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  },

  async createSupplierNote(
    tenantId: string,
    supplierId: string,
    input: CreateSupplierNoteInput,
    createdBy: string = 'User',
  ): Promise<SupplierNote> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (!suppliersStore.some((supplier) => supplier.id === supplierId && supplier.tenantId === tenantId)) throw new Error('Supplier not found');
    const now = new Date().toISOString();
    const newNote: SupplierNote = {
      id: `note-${crypto.randomUUID()}`,
      tenantId,
      supplierId,
      content: input.content.trim(),
      createdBy,
      createdAt: now,
      updatedAt: now,
    };
    supplierNotesStore = [newNote, ...supplierNotesStore];
    return newNote;
  },

  async updateSupplierNote(
    tenantId: string,
    supplierId: string,
    noteId: string,
    input: UpdateSupplierNoteInput,
    updatedBy: string = 'User',
  ): Promise<SupplierNote> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const index = supplierNotesStore.findIndex(
      (n) => n.id === noteId && n.supplierId === supplierId && n.tenantId === tenantId,
    );
    if (index === -1) throw new Error('Supplier note not found');

    const updatedNote: SupplierNote = {
      ...supplierNotesStore[index],
      content: input.content.trim(),
      updatedAt: new Date().toISOString(),
      updatedBy,
    };
    supplierNotesStore[index] = updatedNote;
    return updatedNote;
  },

  async deleteSupplierNote(
    tenantId: string,
    supplierId: string,
    noteId: string,
  ): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const exists = supplierNotesStore.some(
      (n) => n.id === noteId && n.supplierId === supplierId && n.tenantId === tenantId,
    );
    if (!exists) throw new Error('Supplier note not found');

    supplierNotesStore = supplierNotesStore.filter((n) => n.id !== noteId);
    return true;
  },

  // ───────────────────────────── 19.27 – Activity / Timeline ─────────────────────────────

  async getSupplierActivity(
    tenantId: string,
    supplierId: string,
  ): Promise<SupplierActivity[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const supplier = suppliersStore.find(
      (s) => s.id === supplierId && s.tenantId === tenantId,
    );
    if (!supplier) return [];

    const categories: SupplierActivity['category'][] = [
      'general',
      'status',
      'order',
      'payment',
      'document',
      'note',
    ];

    const actions: Record<string, { action: string; description: string }[]> = {
      general: [
        { action: 'Supplier Updated', description: `Contact person updated to ${supplier.contactPerson}.` },
        { action: 'Category Changed', description: `Category set to ${supplier.category ?? 'Other'}.` },
      ],
      status: [
        { action: 'Status Changed', description: `Status changed from Pending to Active.` },
        { action: 'Supplier Approved', description: `Supplier "${supplier.name}" was approved for procurement.` },
      ],
      order: [
        { action: 'Purchase Order Created', description: `PO-2025-0042 created for ${supplier.currency} 12,500.00.` },
        { action: 'Purchase Order Received', description: `PO-2025-0038 marked as fully received.` },
        { action: 'Purchase Order Issued', description: `PO-2025-0045 issued to ${supplier.name}.` },
      ],
      payment: [
        { action: 'Payment Processed', description: `Payment of ${supplier.currency} 8,750.00 processed via bank transfer.` },
        { action: 'Credit Note Applied', description: `Credit note CN-2025-0012 for ${supplier.currency} 450.00 applied.` },
      ],
      document: [
        { action: 'Document Uploaded', description: `Tax registration certificate uploaded.` },
        { action: 'Document Expired', description: `Insurance certificate has expired and needs renewal.` },
      ],
      note: [
        { action: 'Note Added', description: `Internal note added regarding delivery schedules.` },
        { action: 'Note Updated', description: `Note about payment terms clarification updated.` },
      ],
    };

    const actors = ['Sarah Thompson', 'James Chen', 'Emily Rodriguez', 'Michael Kim', 'Admin'];

    const activities: SupplierActivity[] = [];
    const baseDate = new Date();

    for (let i = 0; i < 12; i++) {
      const cat = categories[i % categories.length] ?? 'general';
      const catActions = actions[cat] ?? actions['general'];
      const entry = catActions[i % catActions.length];

      const ts = new Date(baseDate);
      ts.setDate(ts.getDate() - i * 3 - Math.floor(Math.random() * 2));
      ts.setHours(9 + (i % 8), Math.floor(Math.random() * 60));

      activities.push({
        id: `act-${supplierId}-${i}`,
        tenantId,
        supplierId,
        action: entry.action,
        description: entry.description,
        actorName: actors[i % actors.length],
        timestamp: ts.toISOString(),
        category: cat,
      });
    }

    return activities.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  },

  // ───────────────────────────── 19.28 – Purchase History ─────────────────────────────

  async getSupplierPurchaseHistory(
    tenantId: string,
    supplierId: string,
    branchId?: string,
  ): Promise<SupplierPurchaseHistoryOrder[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const supplier = suppliersStore.find(
      (s) => s.id === supplierId && s.tenantId === tenantId,
    );
    if (!supplier) return [];

    const statuses: SupplierPurchaseHistoryOrder['status'][] = ['draft', 'issued', 'received', 'partial', 'cancelled'];
    const orders: SupplierPurchaseHistoryOrder[] = [];
    const baseDate = new Date();

    for (let i = 0; i < 8; i++) {
      const orderDate = new Date(baseDate);
      orderDate.setDate(orderDate.getDate() - i * 12 - ((i * 7 + 3) % 10));

      const expectedDate = new Date(orderDate);
      expectedDate.setDate(expectedDate.getDate() + 14 + ((i * 5 + 2) % 14));

      const supplierSeed = [...supplier.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
      const subtotal = 5000 + ((supplierSeed * 137 + i * 7919) % 25000);
      const taxAmount = Math.round(subtotal * 0.15 * 100) / 100;
      const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
      const status = statuses[i % statuses.length];

      orders.push({
        id: `po-${supplierId}-${i}`,
        tenantId,
        branchId: i % 2 === 0 ? 'branch-001' : 'branch-002',
        poNumber: `PO-2025-${String(42 + i).padStart(4, '0')}`,
        supplierId,
        supplierName: supplier.name,
        orderDate: orderDate.toISOString(),
        expectedDate: expectedDate.toISOString(),
        status,
        currency: supplier.currency,
        items: [
          {
            id: `item-${i}-1`,
            productId: `prod-${i}-1`,
            productName: `Component Part ${i + 1}A`,
            sku: `COMP-${i + 1}A`,
            unit: 'unit',
            quantity: 10 + i * 5,
            unitPrice: Math.round((subtotal * 0.6) / (10 + i * 5) * 100) / 100,
            taxPercent: 15,
            taxAmount: Math.round(subtotal * 0.6 * 0.15 * 100) / 100,
            subtotal: Math.round(subtotal * 0.6 * 100) / 100,
            total: Math.round(subtotal * 0.6 * 1.15 * 100) / 100,
          },
          {
            id: `item-${i}-2`,
            productId: `prod-${i}-2`,
            productName: `Assembly Kit ${i + 1}B`,
            sku: `KIT-${i + 1}B`,
            unit: 'unit',
            quantity: 5 + i * 2,
            unitPrice: Math.round((subtotal * 0.4) / (5 + i * 2) * 100) / 100,
            taxPercent: 15,
            taxAmount: Math.round(subtotal * 0.4 * 0.15 * 100) / 100,
            subtotal: Math.round(subtotal * 0.4 * 100) / 100,
            total: Math.round(subtotal * 0.4 * 1.15 * 100) / 100,
          },
        ],
        subtotal,
        taxAmount,
        totalAmount,
        notes: i % 3 === 0 ? 'Urgent delivery required.' : undefined,
        createdAt: orderDate.toISOString(),
        updatedAt: orderDate.toISOString(),
      });
    }

    return orders.filter((order) => !branchId || order.branchId === branchId).sort(
      (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime(),
    );
  },

  // ───────────────────────────── 19.29 – Transaction History ─────────────────────────────

  async getSupplierTransactions(
    tenantId: string,
    supplierId: string,
    branchId?: string,
  ): Promise<SupplierTransaction[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const supplier = suppliersStore.find(
      (s) => s.id === supplierId && s.tenantId === tenantId,
    );
    if (!supplier) return [];

    const types: SupplierTransaction['type'][] = ['invoice', 'payment', 'credit_note', 'debit_note', 'refund'];
    const statusOptions: SupplierTransaction['status'][] = ['completed', 'pending', 'cleared'];
    const txns: SupplierTransaction[] = [];
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);
    const supplierSeed = [...supplier.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);

    for (let i = 9; i >= 0; i--) {
      const txDate = new Date(baseDate);
      txDate.setDate(txDate.getDate() - i * 8 - ((i * 3 + 1) % 5));

      const type = types[i % types.length];
      const isDebit = type === 'invoice' || type === 'debit_note';

      const amount = 1000 + ((supplierSeed * 113 + i * 3253) % 15000);
      const debit = isDebit ? amount : 0;
      const credit = isDebit ? 0 : amount;
      txns.push({
        id: `txn-${supplierId}-${i}`,
        tenantId,
        branchId: i % 2 === 0 ? 'branch-001' : 'branch-002',
        supplierId,
        transactionNumber: `TXN-2025-${String(100 + i).padStart(4, '0')}`,
        referenceNumber: isDebit ? `INV-2025-${String(200 + i).padStart(4, '0')}` : `PMT-2025-${String(300 + i).padStart(4, '0')}`,
        date: txDate.toISOString(),
        type,
        description: isDebit
          ? `Invoice for purchase order PO-2025-${String(42 + i).padStart(4, '0')}`
          : `Payment against invoice INV-2025-${String(200 + i).padStart(4, '0')}`,
        debit,
        credit,
        balance: 0,
        currency: supplier.currency,
        status: statusOptions[i % statusOptions.length],
      });
    }

    const scoped = txns.filter((transaction) => !branchId || transaction.branchId === branchId);
    let runningBalance = 0;
    for (const transaction of scoped) {
      runningBalance = Math.round((runningBalance + transaction.debit - transaction.credit) * 100) / 100;
      transaction.balance = Math.max(runningBalance, 0);
    }

    return scoped.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  },

  // ───────────────────────────── 19.30 – Outstanding Balance Summary ─────────────────────────────

  async getSupplierBalance(
    tenantId: string,
    supplierId: string,
  ): Promise<SupplierBalanceSummary | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const supplier = suppliersStore.find(
      (s) => s.id === supplierId && s.tenantId === tenantId,
    );
    if (!supplier) return null;

    const totalPurchases = Math.round((50000 + Math.random() * 150000) * 100) / 100;
    const totalPayments = Math.round(totalPurchases * (0.65 + Math.random() * 0.25) * 100) / 100;
    const outstandingBalance = Math.round((totalPurchases - totalPayments) * 100) / 100;
    const overdueAmount = Math.round(outstandingBalance * (0.1 + Math.random() * 0.3) * 100) / 100;

    const lastPayDate = new Date();
    lastPayDate.setDate(lastPayDate.getDate() - Math.floor(Math.random() * 30 + 5));

    return {
      outstandingBalance,
      totalPurchases,
      totalPayments,
      overdueAmount,
      creditLimit: 100000,
      currency: supplier.currency,
      lastPaymentDate: lastPayDate.toISOString(),
      lastPaymentAmount: Math.round((2000 + Math.random() * 8000) * 100) / 100,
      pendingOrdersCount: Math.floor(Math.random() * 5) + 1,
    };
  },

  async getSupplierStatement(
    tenantId: string,
    supplierId: string,
    startDate: string,
    endDate: string,
    branchId?: string,
  ): Promise<SupplierStatementData | null> {
    const supplier = suppliersStore.find(
      (s) => s.id === supplierId && s.tenantId === tenantId,
    );
    if (!supplier) return null;
    if (!startDate || !endDate || startDate > endDate) {
      return { transactions: [], currency: supplier.currency };
    }

    const transactions = await this.getSupplierTransactions(tenantId, supplierId, branchId);
    const filtered = transactions
      .filter((transaction) => {
        const transactionDate = transaction.date.slice(0, 10);
        return transactionDate >= startDate && transactionDate <= endDate;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      transactions: filtered,
      currency: supplier.currency,
      closingBalance: filtered[filtered.length - 1]?.balance,
    };
  },

  async getSupplierPerformance(
    tenantId: string,
    supplierId: string,
    branchId?: string,
  ): Promise<SupplierPerformanceSummary | null> {
    const supplier = suppliersStore.find(
      (s) => s.id === supplierId && s.tenantId === tenantId,
    );
    if (!supplier) return null;

    const orders = await this.getSupplierPurchaseHistory(tenantId, supplierId, branchId);
    const openOrders = orders.filter(
      (order) => order.status === 'issued' || order.status === 'partial',
    );
    const supplierSeed = [...supplier.id].reduce(
      (sum, character) => sum + character.charCodeAt(0),
      0,
    );
    return {
      purchaseOrderCount: orders.length,
      totalPurchaseOrderValue: orders.reduce((sum, order) => sum + order.totalAmount, 0),
      receivedOrderCount: orders.filter((order) => order.status === 'received').length,
      openOrderCount: openOrders.length,
      openPurchaseOrderValue: openOrders.reduce((sum, order) => sum + order.totalAmount, 0),
      cancelledOrderCount: orders.filter((order) => order.status === 'cancelled').length,
      scheduledDeliveryCount: orders.filter((order) => Boolean(order.expectedDate)).length,
      returnedOrderCount: orders.length ? supplierSeed % Math.min(orders.length + 1, 4) : 0,
      rejectedReceiptCount: orders.length
        ? Math.floor(supplierSeed / 3) % Math.min(orders.length + 1, 4)
        : 0,
      returnIndicatorsAreMock: true,
      currency: supplier.currency,
      deliveryTrackingAvailable: false,
    };
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('suppliers.records', () => suppliersStore, (rows) => { suppliersStore = rows; });
registerList('suppliers.notes', () => supplierNotesStore, (rows) => { supplierNotesStore = rows; });
