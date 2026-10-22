import type { ProductDocument } from '../types/product';

const documentPreview = (title: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1160" viewBox="0 0 900 1160"><rect width="900" height="1160" fill="#f8fafc"/><rect x="80" y="70" width="740" height="1020" rx="18" fill="#fff" stroke="#cbd5e1" stroke-width="4"/><rect x="140" y="150" width="420" height="30" rx="8" fill="#2563eb"/><rect x="140" y="225" width="620" height="16" rx="6" fill="#cbd5e1"/><rect x="140" y="265" width="540" height="16" rx="6" fill="#e2e8f0"/><rect x="140" y="345" width="620" height="360" rx="14" fill="#dbeafe"/><text x="450" y="850" text-anchor="middle" font-family="Arial" font-size="34" fill="#334155">${title}</text></svg>`)}`;

const uploadedAt = '2026-08-03T08:30:00Z';

export const mockProductDocuments: ProductDocument[] = [
  {
    id: 'document-prod-001-1',
    tenantId: 'tenant-001',
    productId: 'prod-001',
    fileName: 'probook-14-quick-start-guide.png',
    fileType: 'image/png',
    fileSize: 384200,
    category: 'manual',
    url: documentPreview('ProBook 14 Quick Start Guide'),
    previewUrl: documentPreview('ProBook 14 Quick Start Guide'),
    uploadedAt,
    uploadedBy: 'usr-001',
    uploadedByName: 'Tenant Administrator',
    createdAt: uploadedAt,
    updatedAt: uploadedAt,
  },
  {
    id: 'document-prod-001-2',
    tenantId: 'tenant-001',
    productId: 'prod-001',
    fileName: 'probook-14-warranty.pdf',
    fileType: 'application/pdf',
    fileSize: 728400,
    category: 'warranty',
    url: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrCg==',
    uploadedAt,
    uploadedBy: 'usr-001',
    uploadedByName: 'Tenant Administrator',
    createdAt: uploadedAt,
    updatedAt: uploadedAt,
  },
];
