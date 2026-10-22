import { useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Download, ExternalLink, Eye, FileSpreadsheet, FileText, Image, Trash2, Upload } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { IconButton } from '@/shared/components/common/IconButton';
import { Modal } from '@/shared/components/common/Modal';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { FormField } from '@/shared/components/forms/FormField';
import { Select } from '@/shared/components/forms/Select';
import { formatDate } from '@/shared/utils/formatters';
import { appToast } from '@/shared/utils/toast';
import { useProductDocuments } from '../hooks/useProductDocuments';
import { usePermissions } from '@/core/permissions/permission-context';
import { TENANT_PERMISSIONS as P } from '@/core/permissions/tenantPermissionConstants';
import { productDocumentUploadSchema, type ProductDocumentUploadValues } from '../schemas/productDocumentSchema';
import type { ProductDocument, ProductDocumentCategory } from '../types/product';
import { ProductSectionSkeleton } from './ProductLoadingStates';

interface ProductDocumentsSectionProps {
  productId: string;
  canManage: boolean;
  canDownload: boolean;
}

const categoryLabels: Record<ProductDocumentCategory, string> = {
  manual: 'Manual',
  specification: 'Specification',
  certificate: 'Certificate',
  warranty: 'Warranty',
  other: 'Other',
};
const categoryOptions = Object.entries(categoryLabels).map(([value, label]) => ({ value, label }));

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fileKind(document: ProductDocument) {
  if (document.fileType.startsWith('image/')) return 'image';
  if (document.fileType.includes('sheet') || document.fileType.includes('excel')) return 'spreadsheet';
  return 'document';
}

function DocumentIcon({ document }: { document: ProductDocument }) {
  const kind = fileKind(document);
  if (kind === 'image') return <Image size={20} className="text-sky-600" />;
  if (kind === 'spreadsheet') return <FileSpreadsheet size={20} className="text-emerald-600" />;
  return <FileText size={20} className="text-blue-600" />;
}

export function ProductDocumentsSection({ productId, canManage, canDownload }: ProductDocumentsSectionProps) {
  const { hasPermission } = usePermissions();
  const canUploadFiles = canManage && hasPermission(P.DOCUMENTS.UPLOAD);
  const canRemoveFiles = canManage && hasPermission(P.DOCUMENTS.ARCHIVE);
  const canAccessFiles = canDownload && hasPermission(P.DOCUMENTS.DOWNLOAD);
  const inputRef = useRef<HTMLInputElement>(null);
  const documents = useProductDocuments(productId);
  const [previewing, setPreviewing] = useState<ProductDocument | null>(null);
  const [removing, setRemoving] = useState<ProductDocument | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductDocumentUploadValues>({
    resolver: zodResolver(productDocumentUploadSchema),
    defaultValues: { category: 'manual' },
  });

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const selectedFiles = Array.from(files);
    void handleSubmit(async ({ category }) => {
      setActionError(null);
      try {
        await documents.upload({ files: selectedFiles, category });
        appToast.success(`${selectedFiles.length} product document${selectedFiles.length === 1 ? '' : 's'} uploaded.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to upload product documents.';
        setActionError(message);
        appToast.error(message);
      } finally {
        if (inputRef.current) inputRef.current.value = '';
      }
    })();
  };

  const runAction = async (action: () => Promise<unknown>, success?: string) => {
    setActionError(null);
    try {
      const result = await action();
      if (success) appToast.success(success);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to access the product document.';
      setActionError(message);
      appToast.error(message);
      return null;
    }
  };

  const openDocument = async (document: ProductDocument) => {
    const url = await runAction(() => documents.getAccessUrl(document.id));
    if (typeof url !== 'string') return;
    const link = window.document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    window.document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const downloadDocument = async (document: ProductDocument) => {
    const url = await runAction(() => documents.getAccessUrl(document.id));
    if (typeof url !== 'string') return;
    const link = window.document.createElement('a');
    link.href = url;
    link.download = document.fileName;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    appToast.success(`Download started for ${document.fileName}.`);
  };

  const confirmRemoval = async () => {
    if (!removing) return;
    const removed = await runAction(() => documents.remove(removing.id), 'Product document removed.');
    if (removed !== null) setRemoving(null);
  };

  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Product Documents</h2>
          <p className="mt-1 text-sm text-slate-500">Manuals, specifications, certificates, warranties and other product attachments.</p>
        </div>
        {canUploadFiles && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-start">
            <FormField label="Document category" error={errors.category?.message} className="w-full sm:w-48">
              <Select options={categoryOptions} {...register('category')} />
            </FormField>
            <input
              ref={inputRef}
              type="file"
              aria-label="Upload product documents"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
              multiple
              className="hidden"
              onChange={(event) => handleFiles(event.target.files)}
            />
            <Button type="button" className="sm:mt-6" leftIcon={<Upload size={16} />} isLoading={documents.isUploading} onClick={() => inputRef.current?.click()}>
              Upload Documents
            </Button>
          </div>
        )}
      </div>

      {documents.isUploading && (
        <div className="mt-4" aria-live="polite">
          <div className="mb-1 flex justify-between text-xs text-slate-600"><span>Uploading documents...</span><span>{documents.uploadProgress}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${documents.uploadProgress}%` }} /></div>
        </div>
      )}

      {actionError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>}

      {documents.error ? (
        <div className="mt-4"><ErrorState message={documents.error} onRetry={() => void documents.refetch()} /></div>
      ) : documents.isLoading ? (
        <ProductSectionSkeleton rows={2} />
      ) : documents.documents.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
          <FileText className="mx-auto text-slate-400" size={28} />
          <p className="mt-2 text-sm font-medium text-slate-700">No product documents</p>
          <p className="mt-1 text-xs text-slate-500">{canUploadFiles ? 'Upload a document to start the product file library.' : 'No documents have been added to this product.'}</p>
        </div>
      ) : (
        <div className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
          {documents.documents.map((document) => (
            <div key={document.id} className="flex flex-col gap-3 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50"><DocumentIcon document={document} /></div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900" title={document.fileName}>{document.fileName}</p>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{categoryLabels[document.category]}</span>
                    <span>{formatFileSize(document.fileSize)}</span>
                    <span>{formatDate(document.uploadedAt)}</span>
                    <span>Uploaded by {document.uploadedByName}</span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-slate-400">{document.fileType}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-end">
                <IconButton type="button" icon={<Eye size={16} />} label="Preview document" onClick={() => setPreviewing(document)} />
                {canAccessFiles && (
                  <>
                    <IconButton type="button" icon={<ExternalLink size={16} />} label="Open document" disabled={documents.isAccessing} onClick={() => void openDocument(document)} />
                    <IconButton type="button" icon={<Download size={16} />} label="Download document" disabled={documents.isAccessing} onClick={() => void downloadDocument(document)} />
                  </>
                )}
                {canRemoveFiles && <IconButton type="button" icon={<Trash2 size={16} />} label="Remove document" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={documents.isSaving} onClick={() => setRemoving(document)} />}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={Boolean(previewing)}
        onClose={() => setPreviewing(null)}
        title={previewing?.fileName ?? 'Document Preview'}
        maxWidth="900px"
        footer={previewing ? (
          <>
            <Button type="button" variant="secondary" onClick={() => setPreviewing(null)}>Close</Button>
            {canAccessFiles && <Button type="button" variant="secondary" leftIcon={<ExternalLink size={16} />} onClick={() => void openDocument(previewing)}>Open</Button>}
            {canAccessFiles && <Button type="button" leftIcon={<Download size={16} />} onClick={() => void downloadDocument(previewing)}>Download</Button>}
          </>
        ) : undefined}
      >
        {previewing && (
          <div>
            {previewing.previewUrl && previewing.fileType.startsWith('image/') ? (
              <img src={previewing.previewUrl} alt={previewing.fileName} className="mx-auto max-h-[65vh] max-w-full rounded-lg object-contain" />
            ) : previewing.previewUrl && previewing.fileType === 'application/pdf' ? (
              <iframe src={previewing.previewUrl} title={previewing.fileName} className="h-[65vh] w-full rounded-lg border border-slate-200" />
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
                <FileText size={36} className="mx-auto text-slate-400" />
                <p className="mt-3 text-sm font-semibold text-slate-900">Preview is not available for this file.</p>
                <p className="mt-1 text-xs text-slate-500">{categoryLabels[previewing.category]} · {formatFileSize(previewing.fileSize)} · {previewing.fileType}</p>
                <p className="mt-1 text-xs text-slate-500">Uploaded {formatDate(previewing.uploadedAt)} by {previewing.uploadedByName}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(removing)}
        title="Remove Product Document"
        message={`Remove "${removing?.fileName ?? 'this document'}"? This mock attachment will no longer be available to the product.`}
        confirmLabel="Remove Document"
        variant="danger"
        isLoading={documents.isRemoving}
        onCancel={() => setRemoving(null)}
        onConfirm={() => void confirmRemoval()}
      />
    </Card>
  );
}
