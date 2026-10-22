import type { ProductDocument, ProductDocumentCategory } from '../types/product';
import { storeUploadedFile } from '@/core/persistence/backendSession';
import { productDocumentStore, revokeProductDocumentUrl } from './productDocumentStore';
import { documentService, type DocumentScope } from '@/features/documents/documentService';
import type { DocumentRecord } from '@/shared/types/document-record';

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const allowedExtensions = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'webp']);
const mimeTypeByExtension: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
const maxFileSize = 10 * 1024 * 1024;
const maxDocuments = 20;
const wait = (duration: number) => new Promise((resolve) => globalThis.setTimeout(resolve, duration));

export interface UploadProductDocumentsInput {
  files: File[];
  category: ProductDocumentCategory;
  uploadedBy: string;
  uploadedByName: string;
}

function scopedDocuments(tenantId: string, productId: string) {
  return productDocumentStore.records
    .filter((document) => document.tenantId === tenantId && document.productId === productId)
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
}

function clone(document: ProductDocument): ProductDocument {
  return { ...document };
}

function fileExtension(fileName: string) {
  return fileName.split('.').pop()?.toLocaleLowerCase() ?? '';
}

function canPreview(fileType: string) {
  return fileType === 'application/pdf' || fileType.startsWith('image/');
}
function documentScope(tenantId: string, branchId: string, permittedBranchIds: string[]): DocumentScope { return { tenantId, branchId, permittedBranchIds }; }
function syncToLibrary(tenantId: string, branchId: string, productId: string) {
  documentService.importLegacy(tenantId, branchId, scopedDocuments(tenantId, productId).map((row): DocumentRecord => ({ id: row.id, name: row.fileName, category: row.category, mimeType: row.fileType, sizeBytes: row.fileSize, uploadedAt: row.uploadedAt, uploadedBy: row.uploadedByName, entityType: 'Inventory', entityId: productId, entityReference: productId, url: row.url, previewUrl: row.previewUrl })));
}
function fromLibrary(row: DocumentRecord, tenantId: string, productId: string): ProductDocument { return { id: row.id, tenantId, productId, fileName: row.name, fileType: row.mimeType, fileSize: row.sizeBytes, category: (['manual', 'specification', 'certificate', 'warranty'].includes(row.category) ? row.category : 'other') as ProductDocumentCategory, url: row.url ?? row.previewUrl ?? '', previewUrl: row.previewUrl, uploadedAt: row.uploadedAt, uploadedBy: row.uploadedBy, uploadedByName: row.uploadedBy, createdAt: row.uploadedAt, updatedAt: row.uploadedAt }; }

export const productDocumentService = {
  async getAll(tenantId: string, productId: string, branchId = 'branch-001', permittedBranchIds: string[] = [branchId]): Promise<ProductDocument[]> {
    await wait(100);
    if (productId.startsWith('draft-product-')) return scopedDocuments(tenantId, productId).map(clone);
    syncToLibrary(tenantId, branchId, productId);
    return documentService.linkedPublic(documentScope(tenantId, branchId, permittedBranchIds), 'Inventory', productId).map((row) => fromLibrary(row, tenantId, productId));
  },

  async upload(
    tenantId: string,
    productId: string,
    input: UploadProductDocumentsInput,
    onProgress?: (progress: number) => void,
    branchId = 'branch-001',
    permittedBranchIds: string[] = [branchId],
  ): Promise<ProductDocument[]> {
    if (!input.files.length) return [];
    const existing = productId.startsWith('draft-product-') ? scopedDocuments(tenantId, productId).length : documentService.linkedPublic(documentScope(tenantId, branchId, permittedBranchIds), 'Inventory', productId).length;
    if (existing + input.files.length > maxDocuments) {
      throw new Error(`A product can contain up to ${maxDocuments} documents.`);
    }
    for (const file of input.files) {
      documentService.validateFile(file);
      if (!allowedMimeTypes.has(file.type) && !allowedExtensions.has(fileExtension(file.name))) {
        throw new Error(`${file.name} is not a supported PDF, Word, Excel or image file.`);
      }
      if (file.size > maxFileSize) throw new Error(`${file.name} exceeds the 10 MB document limit.`);
    }

    for (const progress of [15, 35, 60, 85, 100]) {
      await wait(70);
      onProgress?.(progress);
    }

    const timestamp = new Date().toISOString();
    const fileUrls = await Promise.all(input.files.map((file) => storeUploadedFile(file)));
    const uploaded = input.files.map((file, index): ProductDocument => {
      const objectUrl = fileUrls[index];
      const fileType = file.type || mimeTypeByExtension[fileExtension(file.name)] || 'application/octet-stream';
      return {
        id: `product-document-${crypto.randomUUID().slice(0, 8)}`,
        tenantId,
        productId,
        fileName: file.name,
        fileType,
        fileSize: file.size,
        category: input.category,
        url: objectUrl,
        previewUrl: canPreview(fileType) ? objectUrl : undefined,
        uploadedAt: timestamp,
        uploadedBy: input.uploadedBy,
        uploadedByName: input.uploadedByName,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    });
    productDocumentStore.records = [...productDocumentStore.records, ...uploaded];
    if (!productId.startsWith('draft-product-')) syncToLibrary(tenantId, branchId, productId);
    return uploaded.map(clone);
  },

  async getAccessUrl(tenantId: string, productId: string, documentId: string, branchId = 'branch-001', permittedBranchIds: string[] = [branchId], permissions: readonly string[] = [], actor = { id: 'unknown', name: 'Unknown user' }): Promise<string> {
    await wait(80);
    if (!productId.startsWith('draft-product-')) { const scope = documentScope(tenantId, branchId, permittedBranchIds); const row = documentService.get(scope, permissions, documentId); if (row.entityType !== 'Inventory' || row.entityId !== productId) throw new Error('Document does not belong to this product.'); return documentService.download(scope, permissions, actor, documentId).url; }
    const document = productDocumentStore.records.find(
      (item) => item.tenantId === tenantId && item.productId === productId && item.id === documentId,
    );
    if (!document) throw new Error('Product document not found.');
    return document.url;
  },

  async remove(tenantId: string, productId: string, documentId: string, branchId = 'branch-001', permittedBranchIds: string[] = [branchId], permissions: readonly string[] = [], actor = { id: 'unknown', name: 'Unknown user' }): Promise<void> {
    await wait(160);
    if (!productId.startsWith('draft-product-')) { const scope = documentScope(tenantId, branchId, permittedBranchIds); const row = documentService.get(scope, permissions, documentId); if (row.entityType !== 'Inventory' || row.entityId !== productId) throw new Error('Document does not belong to this product.'); documentService.archive(scope, permissions, actor, documentId); }
    const document = productDocumentStore.records.find(
      (item) => item.tenantId === tenantId && item.productId === productId && item.id === documentId,
    );
    if (!document && productId.startsWith('draft-product-')) throw new Error('Product document not found.');
    if (document) revokeProductDocumentUrl(document);
    productDocumentStore.records = productDocumentStore.records.filter(
      (item) => !(item.tenantId === tenantId && item.productId === productId && item.id === documentId),
    );
  },

  async attachToProduct(tenantId: string, temporaryProductId: string, productId: string, branchId = 'branch-001'): Promise<ProductDocument[]> {
    await wait(120);
    productDocumentStore.records = productDocumentStore.records.map((document) =>
      document.tenantId === tenantId && document.productId === temporaryProductId
        ? { ...document, productId, updatedAt: new Date().toISOString() }
        : document,
    );
    syncToLibrary(tenantId, branchId, productId);
    return scopedDocuments(tenantId, productId).map(clone);
  },

  discardTemporary(tenantId: string, temporaryProductId: string) {
    const discarded = scopedDocuments(tenantId, temporaryProductId);
    discarded.forEach(revokeProductDocumentUrl);
    productDocumentStore.records = productDocumentStore.records.filter(
      (document) => !(document.tenantId === tenantId && document.productId === temporaryProductId),
    );
  },
};
