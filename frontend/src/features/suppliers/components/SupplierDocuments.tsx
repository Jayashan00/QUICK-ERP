import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Download,
  FileText,
  Plus,
  Trash2,
  Calendar,
  AlertTriangle,
  Eye,
  ExternalLink,
  FileSpreadsheet,
  Image as ImageIcon,
} from 'lucide-react';

import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { Modal } from '@/shared/components/common/Modal';
import { DatePicker } from '@/shared/components/forms/DatePicker';
import { FileUpload } from '@/shared/components/forms/FileUpload';
import { FormField } from '@/shared/components/forms/FormField';
import { Select } from '@/shared/components/forms/Select';
import { TextInput } from '@/shared/components/forms/TextInput';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { appToast } from '@/shared/utils/toast';
import { usePermissions } from '@/core/permissions/permission-context';
import { PERMISSIONS } from '@/core/permissions/permissionConstants';
import { TENANT_PERMISSIONS } from '@/core/permissions/tenantPermissionConstants';
import { useTenant } from '@/core/tenant/tenant-context';
import { documentService } from '@/features/documents/documentService';
import type { Supplier } from '../types/supplier';
import type { DocumentRecord } from '@/shared/types/document-record';
import { useSupplierDocuments } from '../hooks/useSupplierDocuments';

const categoryLabels: Record<string, string> = {
  contract: 'Contract',
  finance: 'Finance & Tax',
  identity: 'Legal / Registration',
  general: 'General Document',
};

const uploadSchema = z.object({
  category: z.string().min(1, 'Select a document category.'),
  expiryDate: z.string().optional(),
  entityType: z.string().trim().max(80),
  entityReference: z.string().trim().max(120),
});

type UploadFormValues = z.infer<typeof uploadSchema>;

interface SupplierDocumentsProps {
  supplier: Supplier;
}

export function SupplierDocuments({ supplier }: SupplierDocumentsProps) {
  const { tenantId } = useTenant();
  const { hasPermission } = usePermissions();
  const canUpload = hasPermission(PERMISSIONS.SUPPLIERS.SUPPLIERS_EDIT) && hasPermission(TENANT_PERMISSIONS.DOCUMENTS.UPLOAD);
  const canDelete =
    hasPermission(TENANT_PERMISSIONS.DOCUMENTS.ARCHIVE) &&
    (hasPermission(PERMISSIONS.SUPPLIERS.SUPPLIERS_DELETE) || hasPermission(PERMISSIONS.SUPPLIERS.SUPPLIERS_EDIT));
  const documentCategories = tenantId ? documentService.categories({ tenantId, branchId: '', permittedBranchIds: [] }).filter((category) => category.active).map((category) => ({ value: category.id, label: category.name })) : [];

  const {
    documents,
    isLoading,
    error,
    refetch,
    uploadDocument,
    deleteDocument,
    downloadDocument,
    isUploading,
    isDeleting,
  } = useSupplierDocuments(supplier.id, supplier.code);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<DocumentRecord | null>(null);
  const [previewingDoc, setPreviewingDoc] = useState<DocumentRecord | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      category: 'contract',
      expiryDate: '',
      entityType: 'Supplier',
      entityReference: supplier.code,
    },
  });

  const handleCloseUpload = () => {
    setIsUploadOpen(false);
    setSelectedFile(null);
    setFileError(null);
    reset();
  };

  const handleUploadSubmit = async (data: UploadFormValues) => {
    if (!selectedFile) {
      setFileError('Please select a file to upload.');
      return;
    }

    try {
      await uploadDocument(selectedFile, {
        category: data.category,
        expiryDate: data.expiryDate || '',
        entityType: 'Supplier',
        entityReference: supplier.code,
      });
      appToast.success(`Document "${selectedFile.name}" uploaded successfully.`);
      handleCloseUpload();
    } catch {
      appToast.error('Failed to upload document. Please try again.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingDoc) return;
    try {
      await deleteDocument(deletingDoc.id);
      appToast.success(`Document "${deletingDoc.name}" has been removed.`);
      setDeletingDoc(null);
    } catch {
      appToast.error('Failed to remove document. Please try again.');
    }
  };

  const handleDownload = (doc: DocumentRecord) => {
    downloadDocument(doc);
    appToast.success(`Download started for "${doc.name}".`);
  };

  const handleOpenInNewTab = (doc: DocumentRecord) => {
    if (!doc.previewUrl) return;
    window.open(doc.previewUrl, '_blank', 'noopener,noreferrer');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isExpired = (expiryDate?: string): boolean => {
    if (!expiryDate) return false;
    return new Date(expiryDate).getTime() < Date.now();
  };

  const getDocIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <ImageIcon size={20} className="text-sky-600" />;
    }
    if (mimeType.includes('sheet') || mimeType.includes('excel')) {
      return <FileSpreadsheet size={20} className="text-emerald-600" />;
    }
    return <FileText size={20} className="text-blue-600" />;
  };

  return (
    <Card className="p-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Supplier Documents & Attachments
            </h3>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {documents.length}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Contracts, compliance certifications, tax forms, and banking verification files.
          </p>
        </div>
        {canUpload && (
          <Button
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => setIsUploadOpen(true)}
          >
            Upload Document
          </Button>
        )}
      </div>

      {/* Content states */}
      {isLoading ? (
        <div className="space-y-3 p-6">
          <Skeleton height={56} />
          <Skeleton height={56} />
        </div>
      ) : error ? (
        <div className="p-6">
          <ErrorState message={error} onRetry={() => void refetch()} />
        </div>
      ) : documents.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No documents uploaded yet"
            message="Upload contracts, tax certificates, bank letters, or vendor compliance documents."
            action={
              canUpload ? (
                <Button
                  size="sm"
                  leftIcon={<Plus size={14} />}
                  onClick={() => setIsUploadOpen(true)}
                >
                  Upload Document
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {documents.map((doc) => {
            const expired = isExpired(doc.expiryDate);
            return (
              <div
                key={doc.id}
                className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-lg bg-slate-50 p-2.5 shrink-0 border border-slate-100">
                    {getDocIcon(doc.mimeType)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {doc.name}
                      </span>
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {categoryLabels[doc.category] ?? doc.category}
                      </span>
                      {doc.expiryDate && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                            expired
                              ? 'bg-red-50 text-red-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {expired ? <AlertTriangle size={11} /> : <Calendar size={11} />}
                          {expired ? 'Expired: ' : 'Expires: '}
                          {new Date(doc.expiryDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>{formatFileSize(doc.sizeBytes)}</span>
                      <span>•</span>
                      <span>{doc.mimeType}</span>
                      <span>•</span>
                      <span>
                        Uploaded by <strong className="font-medium text-slate-700">{doc.uploadedBy || 'User'}</strong> on{' '}
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Eye size={14} />}
                    onClick={() => setPreviewingDoc(doc)}
                  >
                    Preview
                  </Button>
                  {hasPermission(TENANT_PERMISSIONS.DOCUMENTS.DOWNLOAD) && <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Download size={14} />}
                    onClick={() => handleDownload(doc)}
                  >
                    Download
                  </Button>}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Trash2 size={14} />}
                      onClick={() => setDeletingDoc(doc)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Document Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={isUploading ? () => undefined : handleCloseUpload}
        title="Upload Supplier Document"
        maxWidth="600px"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" onClick={handleCloseUpload} disabled={isUploading}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="supplier-document-upload-form"
              isLoading={isUploading}
            >
              Upload Document
            </Button>
          </div>
        }
      >
        <form
          id="supplier-document-upload-form"
          className="space-y-4"
          onSubmit={handleSubmit(handleUploadSubmit)}
          noValidate
        >
          <FormField label="Select File" required error={fileError ?? undefined}>
            <FileUpload
              id="supplier-doc-file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
              maxSizeMb={10}
              selectedFileName={selectedFile?.name}
              error={fileError ?? undefined}
              onError={setFileError}
              onFileSelect={(file) => {
                setSelectedFile(file);
                setFileError(null);
              }}
            />
          </FormField>

          <FormField
            label="Document Category"
            required
            error={errors.category?.message}
          >
            <Select
              id="supplier-doc-category"
              options={documentCategories}
              error={Boolean(errors.category)}
              {...register('category')}
            />
          </FormField>

          <FormField
            label="Expiry Date"
            error={errors.expiryDate?.message}
            hint="Set expiration for compliance certificates or time-bound agreements (optional)"
          >
            <DatePicker id="supplier-doc-expiry" {...register('expiryDate')} />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Entity Type" error={errors.entityType?.message}>
              <TextInput
                id="supplier-doc-entity-type"
                readOnly
                className="bg-slate-50 text-slate-600"
                {...register('entityType')}
              />
            </FormField>
            <FormField label="Supplier Code" error={errors.entityReference?.message}>
              <TextInput
                id="supplier-doc-entity-ref"
                readOnly
                className="bg-slate-50 font-mono text-slate-600 uppercase"
                {...register('entityReference')}
              />
            </FormField>
          </div>

          <p className="text-xs text-slate-500">
            Allowed formats: PDF, PNG, JPG, Word (.doc, .docx), Excel (.xls, .xlsx). Max file size: 10 MB.
          </p>
        </form>
      </Modal>

      {/* Document Preview Modal */}
      <Modal
        isOpen={Boolean(previewingDoc)}
        onClose={() => setPreviewingDoc(null)}
        title={previewingDoc?.name ?? 'Document Preview'}
        maxWidth="850px"
        footer={
          previewingDoc ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div>
                {previewingDoc.previewUrl && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<ExternalLink size={14} />}
                    onClick={() => handleOpenInNewTab(previewingDoc)}
                  >
                    Open in New Tab
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPreviewingDoc(null)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  leftIcon={<Download size={14} />}
                  onClick={() => handleDownload(previewingDoc)}
                >
                  Download
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {previewingDoc && (
          <div>
            {previewingDoc.previewUrl &&
            previewingDoc.mimeType.startsWith('image/') ? (
              <div className="flex justify-center rounded-lg bg-slate-100 p-2">
                <img
                  src={previewingDoc.previewUrl}
                  alt={previewingDoc.name}
                  className="max-h-[60vh] max-w-full rounded object-contain shadow-sm"
                />
              </div>
            ) : previewingDoc.previewUrl &&
              (previewingDoc.mimeType === 'application/pdf' ||
                previewingDoc.mimeType.includes('pdf')) ? (
              <div className="w-full overflow-hidden rounded-lg border border-slate-200">
                <iframe
                  src={previewingDoc.previewUrl}
                  title={previewingDoc.name}
                  className="h-[65vh] w-full"
                />
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <FileText size={28} />
                </div>
                <h4 className="mt-3 text-sm font-semibold text-slate-900">
                  Preview is not available for this file format
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Inline preview is supported for PDF and image documents. You can download this file to inspect its contents.
                </p>
                <div className="mt-4 inline-flex flex-col gap-1.5 rounded-md border border-slate-200 bg-white p-4 text-left text-xs text-slate-700 shadow-sm max-w-md w-full">
                  <div>
                    <span className="font-medium text-slate-500">Filename: </span>
                    <span className="font-semibold text-slate-900">{previewingDoc.name}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-500">Category: </span>
                    <span>{categoryLabels[previewingDoc.category] ?? previewingDoc.category}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-500">File Size: </span>
                    <span>{formatFileSize(previewingDoc.sizeBytes)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-500">MIME Type: </span>
                    <span>{previewingDoc.mimeType}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-500">Uploaded: </span>
                    <span>
                      {new Date(previewingDoc.uploadedAt).toLocaleDateString()} by{' '}
                      {previewingDoc.uploadedBy || 'User'}
                    </span>
                  </div>
                  {previewingDoc.expiryDate && (
                    <div>
                      <span className="font-medium text-slate-500">Expiry Date: </span>
                      <span>{new Date(previewingDoc.expiryDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Document Confirmation Dialog */}
      {canDelete && (
        <ConfirmDialog
          isOpen={Boolean(deletingDoc)}
          title="Delete Document"
          message={`Are you sure you want to remove "${deletingDoc?.name}"? This action cannot be undone.`}
          variant="danger"
          confirmLabel="Delete Document"
          isLoading={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingDoc(null)}
        />
      )}
    </Card>
  );
}
