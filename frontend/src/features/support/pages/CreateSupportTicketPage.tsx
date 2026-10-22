import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useBranch } from '@/core/branch/branch-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { documentService } from '@/features/documents/documentService';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { PermissionDenied } from '@/shared/components/feedback/PermissionDenied';
import { FileUpload } from '@/shared/components/forms/FileUpload';
import { FormField } from '@/shared/components/forms/FormField';
import { Select } from '@/shared/components/forms/Select';
import { Textarea } from '@/shared/components/forms/Textarea';
import { TextInput } from '@/shared/components/forms/TextInput';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { appToast } from '@/shared/utils/toast';
import { supportCategoryLabels } from '../components/supportLabels';
import { useSupportActions } from '../hooks/useSupportTickets';
import { supportTicketSchema } from '../schemas/supportSchemas';
import { supportCategories, supportModules, supportPriorities } from '../types/support';

type FormValues = z.infer<typeof supportTicketSchema>;
const label = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

export function CreateSupportTicketPage() {
  const navigate = useNavigate(); const { branches, branchId } = useBranch(); const { hasPermission } = usePermissions(); const actions = useSupportActions(); const [files, setFiles] = useState<File[]>([]); const [fileError, setFileError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(supportTicketSchema), defaultValues: { subject: '', description: '', category: 'other', priority: 'medium', branchId: branchId ?? '', relatedModule: 'general', relatedRecordId: '', relatedRecordReference: '' } });
  if (!hasPermission('support.create')) return <PermissionDenied message="Permission support.create is required to create a support ticket." />;
  const addFile = (file: File) => { try { documentService.validateFile(file); if (files.length >= 5) throw new Error('A ticket can include up to 5 attachments.'); setFiles((current) => [...current, file]); setFileError(''); } catch (error) { setFileError(error instanceof Error ? error.message : 'Invalid attachment.'); } };
  const submit = handleSubmit(async (values) => { try { const ticket = await actions.create({ input: { ...values, branchId: values.branchId || undefined, relatedModule: values.relatedModule || undefined, relatedRecordId: values.relatedRecordId || undefined, relatedRecordReference: values.relatedRecordReference || undefined }, attachments: files }); appToast.success(`${ticket.ticketNumber} created.`); navigate(`/support/tickets/${ticket.id}`); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to create support ticket.'); } });
  return <PageContainer><PageHeader title="Create Support Ticket" description="Send a tenant support request to Quick ERP. Do not use this form for internal employee-to-HR requests." /><Card><form className="space-y-5" onSubmit={submit}><div className="grid gap-4 md:grid-cols-2"><FormField className="md:col-span-2" label="Subject" htmlFor="support-subject" required error={errors.subject?.message}><TextInput id="support-subject" {...register('subject')} /></FormField><FormField label="Category" htmlFor="support-category" required error={errors.category?.message}><Select id="support-category" {...register('category')} options={supportCategories.map((value) => ({ value, label: supportCategoryLabels[value] }))} /></FormField><FormField label="Priority" htmlFor="support-priority" required error={errors.priority?.message}><Select id="support-priority" {...register('priority')} options={supportPriorities.map((value) => ({ value, label: label(value) }))} /></FormField><FormField label="Branch" htmlFor="support-branch" hint="Choose Company-wide if the issue is not branch-specific."><Select id="support-branch" {...register('branchId')} options={[{ value: '', label: 'Company-wide' }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]} /></FormField><FormField label="Related module" htmlFor="support-module" error={errors.relatedModule?.message}><Select id="support-module" {...register('relatedModule')} options={supportModules.map((value) => ({ value, label: label(value) }))} /></FormField><FormField label="Related record ID" htmlFor="support-record-id" error={errors.relatedRecordId?.message}><TextInput id="support-record-id" {...register('relatedRecordId')} /></FormField><FormField label="Related reference" htmlFor="support-record-reference" error={errors.relatedRecordReference?.message}><TextInput id="support-record-reference" {...register('relatedRecordReference')} placeholder="Invoice, SKU, document number..." /></FormField><FormField className="md:col-span-2" label="Description" htmlFor="support-description" required error={errors.description?.message}><Textarea id="support-description" rows={7} {...register('description')} /></FormField></div><div className="rounded-lg border border-slate-200 p-4"><h2 className="text-sm font-semibold text-slate-900">Attachments</h2>{hasPermission('documents.upload') && hasPermission('documents.view') ? <><FileUpload className="mt-3" label="Add screenshot or document" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv" maxSizeMb={10} onFileSelect={addFile} onError={setFileError} error={fileError} /><ul className="mt-3 space-y-2">{files.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2 text-sm"><span className="truncate">{file.name}</span><Button type="button" size="sm" variant="ghost" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button></li>)}</ul></> : <p className="mt-2 text-sm text-slate-500">Document upload permission is required to add attachments.</p>}</div><div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={() => navigate('/support/tickets')}>Cancel</Button><Button type="submit" isLoading={actions.isCreating}>Create Ticket</Button></div></form></Card></PageContainer>;
}
