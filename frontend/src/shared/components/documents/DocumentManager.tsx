import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download, FileText, Plus } from 'lucide-react';

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
import { appToast } from '@/shared/utils/toast';
import type { DocumentRecord } from '@/shared/types/document-record';
import { auditEventService } from '@/core/audit';
import { useAuth } from '@/core/auth/auth-context';
import { useBranch } from '@/core/branch/branch-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { documentService } from '@/features/documents/documentService';

const metadataSchema = z.object({
  category: z.string().min(1, 'Select a document category.'),
  expiryDate: z.string(),
  entityType: z.string().trim().max(80),
  entityReference: z.string().trim().max(120),
});
export type DocumentUploadMetadata = z.infer<typeof metadataSchema>;

interface DocumentManagerProps {
  documents: DocumentRecord[];
  isLoading?: boolean;
  error?: string | null;
  canUpload?: boolean;
  canDownload?: boolean;
  onRetry?: () => void;
  onUpload?: (file: File, metadata: DocumentUploadMetadata) => Promise<void>;
  onDownload?: (document: DocumentRecord) => void;
}

export function DocumentManager({ documents, isLoading, error, canUpload, canDownload, onRetry, onUpload, onDownload }: DocumentManagerProps) {
  const { tenantId } = useTenant();
  const { branchId } = useBranch();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DocumentUploadMetadata>({ resolver: zodResolver(metadataSchema), defaultValues: { category: '', expiryDate: '', entityType: '', entityReference: '' } });

  const close = () => { setIsOpen(false); setFile(null); setFileError(null); reset(); };
  const submit = async (metadata: DocumentUploadMetadata) => {
    if (!file) { setFileError('Select a file to upload.'); return; }
    await onUpload?.(file, metadata);
    if (tenantId && user) auditEventService.record({ tenantId, branchId: branchId ?? undefined, actorId: user.id, actorName: user.name, module: 'documents', entityType: metadata.entityType || 'Document', entityId: metadata.entityReference || file.name, reference: metadata.entityReference || file.name, action: 'Uploaded', description: `${user.name} uploaded ${file.name}.`, newValues: { fileName: file.name, category: metadata.category, expiryDate: metadata.expiryDate || null }, relatedRoute: globalThis.location.pathname, sensitivity: metadata.category === 'identity' || metadata.category === 'finance' ? 'sensitive' : 'normal' });
    appToast.success('Document added to mock storage.');
    close();
  };

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div><h3 className="text-sm font-semibold text-slate-900">Documents</h3><p className="text-xs text-slate-500">Files, categories, expiry dates, and linked records.</p></div>
        {canUpload && <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setIsOpen(true)}>Upload Document</Button>}
      </div>
      {isLoading ? <div className="space-y-3 p-5"><Skeleton height={56} /><Skeleton height={56} /></div>
        : error ? <ErrorState message={error} onRetry={onRetry} />
          : documents.length === 0 ? <EmptyState title="No documents" message="Upload supporting files to link them with this record." />
            : <div className="divide-y divide-slate-100">{documents.map((document) => (
              <div key={document.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-3"><div className="rounded-lg bg-blue-50 p-2 text-blue-600"><FileText size={18} /></div><div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-900">{document.name}</div><div className="mt-1 text-xs text-slate-500">{document.category} · {(document.sizeBytes / 1024).toFixed(1)} KB · {document.mimeType}</div><div className="mt-1 text-xs text-slate-500">{document.entityReference || 'No linked record'}{document.expiryDate ? ` · Expires ${new Date(document.expiryDate).toLocaleDateString()}` : ''}</div></div></div>
                {canDownload && <Button variant="secondary" size="sm" leftIcon={<Download size={14} />} onClick={() => onDownload?.(document)}>Download</Button>}
              </div>
            ))}</div>}
      <Modal isOpen={isOpen} onClose={isSubmitting ? () => undefined : close} title="Upload Document" maxWidth="600px" footer={<div className="flex w-full justify-end gap-2"><Button variant="secondary" onClick={close}>Cancel</Button><Button type="submit" form="document-upload-form" isLoading={isSubmitting}>Add Document</Button></div>}>
        <form id="document-upload-form" className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
          <FormField label="File" required><FileUpload id="document-file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv" maxSizeMb={10} selectedFileName={file?.name} error={fileError ?? undefined} onError={setFileError} onFileSelect={(selected) => { setFile(selected); setFileError(null); }} /></FormField>
          <FormField label="Category" required error={errors.category?.message}><Select options={tenantId ? documentService.categories({ tenantId, branchId: '', permittedBranchIds: [] }).filter((category) => category.active).map((category) => ({ value: category.id, label: category.name })) : []} placeholder="Select category" error={Boolean(errors.category)} {...register('category')} /></FormField>
          <FormField label="Expiry Date" error={errors.expiryDate?.message}><DatePicker {...register('expiryDate')} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2"><FormField label="Entity Type" error={errors.entityType?.message}><TextInput placeholder="e.g. Customer" {...register('entityType')} /></FormField><FormField label="Entity Reference" error={errors.entityReference?.message}><TextInput placeholder="e.g. CUST-0001" {...register('entityReference')} /></FormField></div>
          <p className="text-xs text-slate-500">Allowed: PDF, images, Word, Excel, text and CSV. Maximum size: 10 MB.</p>
        </form>
      </Modal>
    </Card>
  );
}
