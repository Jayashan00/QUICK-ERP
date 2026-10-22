import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/components/common/Button';
import { FormField } from '@/shared/components/forms/FormField';
import { TextInput } from '@/shared/components/forms/TextInput';
import { Select } from '@/shared/components/forms/Select';
import { DatePicker } from '@/shared/components/forms/DatePicker';
import type { Employee } from './types/employee';
import type { Shift, LeaveType } from './hrService';
import type { Department } from '@/features/settings/organization/types/department';
import type { Designation } from '@/features/settings/organization/types/designation';

const required = z.string().trim().min(1, 'Required.');
const employeeSchema = z.object({ employeeCode: required, firstName: required, lastName: required, email: z.email(), phone: z.string().refine((value) => value.replace(/\D/g, '').length >= 7, 'Enter a valid phone.'), branchId: required, departmentId: required, designationId: required, reportingManagerId: z.string(), employmentType: z.enum(['full_time', 'part_time', 'contract', 'intern']), status: z.enum(['active', 'on_leave', 'terminated', 'resigned']), dateOfJoining: z.iso.date(), exitDate: z.string(), salary: z.string().refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, 'Enter a non-negative salary.'), currency: required, address: z.string(), emergencyContactName: z.string(), emergencyContactPhone: z.string(), notes: z.string() }).refine((value) => !value.exitDate || value.exitDate >= value.dateOfJoining, { path: ['exitDate'], message: 'Exit date must follow joining date.' });
export type EmployeeValues = z.infer<typeof employeeSchema>;
const defaultEmployee: EmployeeValues = { employeeCode: '', firstName: '', lastName: '', email: '', phone: '', branchId: '', departmentId: '', designationId: '', reportingManagerId: '', employmentType: 'full_time', status: 'active', dateOfJoining: new Date().toISOString().slice(0, 10), exitDate: '', salary: '0', currency: 'USD', address: '', emergencyContactName: '', emergencyContactPhone: '', notes: '' };

export function EmployeeForm({ initial, branches, departments, designations, employees, onSave, onCancel }: { initial?: Employee; branches: { id: string; name: string }[]; departments: Department[]; designations: Designation[]; employees: Employee[]; onSave: (value: EmployeeValues) => Promise<void>; onCancel: () => void }) {
  const { register, watch, handleSubmit, formState: { errors, isSubmitting } } = useForm<EmployeeValues>({ resolver: zodResolver(employeeSchema), defaultValues: initial ? { ...defaultEmployee, ...initial, salary: String(initial.salary), exitDate: initial.exitDate ?? '', reportingManagerId: initial.reportingManagerId ?? '', address: initial.address ?? '', emergencyContactName: initial.emergencyContactName ?? '', emergencyContactPhone: initial.emergencyContactPhone ?? '', notes: initial.notes ?? '' } : defaultEmployee });
  const departmentId = watch('departmentId');
  const select = (name: keyof EmployeeValues, label: string, options: { value: string; label: string }[]) => <FormField label={label} required error={errors[name]?.message}><Select {...register(name)} options={[{ value: '', label: `Select ${label.toLowerCase()}` }, ...options]} /></FormField>;
  const input = (name: keyof EmployeeValues, label: string, type = 'text') => <FormField label={label} required={['employeeCode', 'firstName', 'lastName', 'email', 'phone', 'dateOfJoining', 'salary'].includes(name)} error={errors[name]?.message}>{type === 'date' ? <DatePicker {...register(name)} /> : <TextInput type={type} {...register(name)} />}</FormField>;
  return <form className="space-y-5" onSubmit={handleSubmit(onSave)}><div className="grid gap-4 sm:grid-cols-2">{input('employeeCode', 'Employee code')}{input('firstName', 'First name')}{input('lastName', 'Last name')}{input('email', 'Email', 'email')}{input('phone', 'Phone')}{select('branchId', 'Branch', branches.map((row) => ({ value: row.id, label: row.name })))}{select('departmentId', 'Department', departments.filter((row) => row.status === 'active').map((row) => ({ value: row.id, label: row.name })))}{select('designationId', 'Designation', designations.filter((row) => row.departmentId === departmentId && row.status === 'active').map((row) => ({ value: row.id, label: row.name })))}{select('reportingManagerId', 'Reporting manager', employees.filter((row) => row.id !== initial?.id).map((row) => ({ value: row.id, label: `${row.firstName} ${row.lastName}` })))}{select('employmentType', 'Employment type', ['full_time', 'part_time', 'contract', 'intern'].map((value) => ({ value, label: value.replace('_', ' ') })))}{select('status', 'Status', ['active', 'on_leave', 'terminated', 'resigned'].map((value) => ({ value, label: value.replace('_', ' ') })))}{input('dateOfJoining', 'Joining date', 'date')}{input('exitDate', 'Exit date', 'date')}{input('salary', 'Base salary', 'number')}{input('currency', 'Currency')}{input('address', 'Address')}{input('emergencyContactName', 'Emergency contact')}{input('emergencyContactPhone', 'Emergency phone')}</div>{input('notes', 'Notes')}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit" isLoading={isSubmitting}>Save employee</Button></div></form>;
}

export type OperationKind = 'shift' | 'roster' | 'attendance' | 'correction' | 'leave' | 'holiday' | 'overtime' | 'payitem' | 'revision' | 'loan' | 'payroll';
export type OperationValues = Record<string, string>;
type Field = { key: string; label: string; type?: 'date' | 'time' | 'number' | 'select'; options?: { value: string; label: string }[] };
const field = (key: string, label: string, type?: Field['type'], options?: Field['options']): Field => ({ key, label, type, options });
const operationSchema = (kind: OperationKind, fields: Field[]) => z.record(z.string(), z.string()).superRefine((values, context) => {
  for (const item of fields) if (!values[item.key]?.trim()) context.addIssue({ code: 'custom', path: [item.key], message: `${item.label} is required.` });
  for (const item of fields.filter((entry) => entry.type === 'date')) if (values[item.key] && !/^\d{4}-\d{2}-\d{2}$/.test(values[item.key])) context.addIssue({ code: 'custom', path: [item.key], message: 'Use a valid YYYY-MM-DD date.' });
  for (const item of fields.filter((entry) => entry.type === 'time')) if (values[item.key] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(values[item.key])) context.addIssue({ code: 'custom', path: [item.key], message: 'Use a valid time.' });
  if (values.startDate && values.endDate && values.endDate < values.startDate) context.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must follow start date.' });
  if (kind === 'shift' && values.start && values.end && values.end <= values.start) context.addIssue({ code: 'custom', path: ['end'], message: 'End time must follow start time.' });
  if (kind === 'attendance' && values.checkIn && values.checkOut && values.checkOut <= values.checkIn) context.addIssue({ code: 'custom', path: ['checkOut'], message: 'Check-out must follow check-in.' });
  for (const key of ['amount', 'hours', 'salary', 'installments', 'breakMinutes']) if (values[key] && (!Number.isFinite(Number(values[key])) || Number(values[key]) < 0 || (['hours', 'installments'].includes(key) && Number(values[key]) === 0))) context.addIssue({ code: 'custom', path: [key], message: 'Enter a valid positive amount.' });
  if (kind === 'payroll' && values.period && !/^\d{4}-(0[1-9]|1[0-2])$/.test(values.period)) context.addIssue({ code: 'custom', path: ['period'], message: 'Use YYYY-MM.' });
});
export function OperationForm({ kind, employees, shifts, leaveTypes, attendance, onSave, onCancel }: { kind: OperationKind; employees: Employee[]; shifts: Shift[]; leaveTypes: LeaveType[]; attendance: { id: string; date: string; employeeId: string }[]; onSave: (value: OperationValues) => Promise<void>; onCancel: () => void }) {
  const [attachment, setAttachment] = useState<File | null>(null);
  const employeeOptions = employees.map((row) => ({ value: row.id, label: `${row.employeeCode} · ${row.firstName} ${row.lastName}` }));
  const configs: Record<OperationKind, Field[]> = {
    shift: [field('name', 'Shift name'), field('start', 'Start time', 'time'), field('end', 'End time', 'time'), field('breakMinutes', 'Break minutes', 'number')],
    roster: [field('employeeId', 'Employee', 'select', employeeOptions), field('date', 'Date', 'date'), field('shiftId', 'Shift', 'select', shifts.filter((row) => row.active).map((row) => ({ value: row.id, label: row.name })))],
    attendance: [field('employeeId', 'Employee', 'select', employeeOptions), field('date', 'Date', 'date'), field('checkIn', 'Check-in', 'time'), field('checkOut', 'Check-out', 'time')],
    correction: [field('attendanceId', 'Attendance', 'select', attendance.map((row) => ({ value: row.id, label: `${employees.find((employee) => employee.id === row.employeeId)?.employeeCode ?? row.employeeId} · ${row.date}` }))), field('requestedIn', 'Corrected check-in', 'time'), field('requestedOut', 'Corrected check-out', 'time'), field('reason', 'Reason')],
    leave: [field('employeeId', 'Employee', 'select', employeeOptions), field('typeId', 'Leave type', 'select', leaveTypes.filter((row) => row.active).map((row) => ({ value: row.id, label: row.name }))), field('startDate', 'Start date', 'date'), field('endDate', 'End date', 'date'), field('reason', 'Reason')],
    holiday: [field('name', 'Holiday name'), field('date', 'Date', 'date'), field('type', 'Type', 'select', [{ value: 'public', label: 'Public' }, { value: 'company', label: 'Company' }])],
    overtime: [field('employeeId', 'Employee', 'select', employeeOptions), field('date', 'Date', 'date'), field('hours', 'Hours', 'number')],
    payitem: [field('employeeId', 'Employee', 'select', employeeOptions), field('kind', 'Type', 'select', [{ value: 'allowance', label: 'Allowance' }, { value: 'deduction', label: 'Deduction' }]), field('name', 'Name'), field('amount', 'Amount', 'number')],
    revision: [field('employeeId', 'Employee', 'select', employeeOptions), field('effectiveDate', 'Effective date', 'date'), field('amount', 'New salary', 'number')],
    loan: [field('employeeId', 'Employee', 'select', employeeOptions), field('type', 'Loan type'), field('amount', 'Amount', 'number'), field('installments', 'Installments', 'number')],
    payroll: [field('period', 'Payroll period (YYYY-MM)')],
  };
  const fields = configs[kind];
  const schema = operationSchema(kind, fields);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<OperationValues>({ resolver: zodResolver(schema), defaultValues: Object.fromEntries(fields.map((item) => [item.key, item.key === 'date' ? new Date().toISOString().slice(0, 10) : item.key === 'breakMinutes' ? '0' : ''])) });
  return <form className="space-y-4" onSubmit={handleSubmit((value) => onSave({ ...value, attachment: attachment?.name ?? '' }))}><div className="grid gap-4 sm:grid-cols-2">{fields.map((item) => <FormField key={item.key} label={item.label} required error={errors[item.key]?.message}>{item.type === 'select' ? <Select {...register(item.key)} options={[{ value: '', label: `Select ${item.label.toLowerCase()}` }, ...(item.options ?? [])]} /> : item.type === 'date' ? <DatePicker {...register(item.key)} /> : <TextInput type={item.type === 'time' ? 'time' : item.type === 'number' ? 'number' : 'text'} min={item.type === 'number' ? '0' : undefined} step={item.type === 'number' ? '0.01' : undefined} {...register(item.key)} />}</FormField>)}</div>{kind === 'leave' && <FormField label="Attachment metadata"><input type="file" className="block w-full text-sm" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} /></FormField>}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit" isLoading={isSubmitting}>Save</Button></div></form>;
}
