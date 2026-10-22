import type { ProductImage } from '../types/product';

const preview = (label: string, background: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="640" height="480" fill="${background}"/><rect x="150" y="90" width="340" height="260" rx="24" fill="#ffffff" opacity="0.92"/><path d="M220 300l85-90 60 58 48-45 77 77H220z" fill="#94a3b8"/><circle cx="400" cy="165" r="34" fill="#60a5fa"/><text x="320" y="410" text-anchor="middle" font-family="Arial" font-size="28" fill="#334155">${label}</text></svg>`)}`;

const createdAt = '2026-08-01T00:00:00Z';

export const mockProductImages: ProductImage[] = [
  { id: 'image-prod-001-1', tenantId: 'tenant-001', productId: 'prod-001', url: preview('ProBook 14 - Front', '#dbeafe'), previewUrl: preview('ProBook 14 - Front', '#dbeafe'), fileName: 'probook-14-front.svg', mimeType: 'image/svg+xml', sizeBytes: 18420, isPrimary: true, sortOrder: 0, createdAt, updatedAt: createdAt },
  { id: 'image-prod-001-2', tenantId: 'tenant-001', productId: 'prod-001', url: preview('ProBook 14 - Side', '#e2e8f0'), previewUrl: preview('ProBook 14 - Side', '#e2e8f0'), fileName: 'probook-14-side.svg', mimeType: 'image/svg+xml', sizeBytes: 17610, isPrimary: false, sortOrder: 1, createdAt, updatedAt: createdAt },
  { id: 'image-prod-005-1', tenantId: 'tenant-001', productId: 'prod-005', url: preview('Ergonomic Chair', '#dcfce7'), previewUrl: preview('Ergonomic Chair', '#dcfce7'), fileName: 'ergonomic-chair.svg', mimeType: 'image/svg+xml', sizeBytes: 16980, isPrimary: true, sortOrder: 0, createdAt, updatedAt: createdAt },
];
