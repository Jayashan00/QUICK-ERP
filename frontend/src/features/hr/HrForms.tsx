import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/components/common/Button';
import { FormField } from '@/shared/components/forms/FormField';
import { TextInput } from '@/shared/components/forms/TextInput';
import { Select } from '@/shared/components/forms/Select';
import { DatePicker } from '@/shared/components/forms/DatePicker';
import type { Employee } from './types/employee';
import type { Shift, LeaveType, Roster } from './hrService';
import type { Department } from '@/features/settings/organization/types/department';
import type { Designation } from '@/features/settings/organization/types/designation';
import { useTenantCurrency } from '@/features/settings/finance/currency';

const required = z.string().trim().min(1, 'This field is required. Please enter a valid value to continue.');
const employeeSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required. Please enter the employee first name.'),
  lastName: z.string().trim().min(1, 'Last name is required. Please enter the employee last name.'),
  email: z.string().trim().min(1, 'Email is required. Please enter an email address.').email('Please enter a valid email address in the format name@company.com.'),
  phone: z.string()
    .trim()
    .min(1, 'Phone number is required. Please enter a valid phone number.')
    .refine((value) => !/[a-zA-Z]/.test(value), 'Phone number cannot contain letters or alphanumeric characters. Please enter a valid phone number.')
    .refine((value) => {
      const digits = value.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15;
    }, 'Please enter a valid phone number with at least 7 digits (e.g., +1 555-123-4567).')
    .refine((value) => /^[+]?[\d\s\-().]+$/.test(value), 'Phone number contains invalid characters.'),
  branchId: z.string().min(1, 'Branch is required. Please select a branch from the dropdown.'),
  departmentId: z.string().min(1, 'Department is required. Please select a department from the dropdown.'),
  designationId: z.string().min(1, 'Designation is required. Please select a designation from the dropdown.'),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'intern'], { error: 'Please select an employment type.' }),
  status: z.enum(['active', 'on_leave', 'terminated', 'resigned'], { error: 'Please select an employee status.' }),
  dateOfJoining: z.iso.date('Please enter a valid joining date in YYYY-MM-DD format.'),
  exitDate: z.string(),
  salary: z.string().refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, 'Salary cannot be negative. Please enter a valid non-negative amount.'),
  currency: required,
  address: z.string(),
  emergencyContactName: z.string(),
  emergencyContactPhone: z.string().refine((value) => !value.trim() || (!/[a-zA-Z]/.test(value) && value.replace(/\D/g, '').length >= 7), 'Emergency phone cannot contain letters and must have at least 7 digits.'),
  notes: z.string(),
}).refine((value) => !value.exitDate || value.exitDate >= value.dateOfJoining, { path: ['exitDate'], message: 'Exit date must follow joining date. Please select an exit date on or after the joining date.' });
export type EmployeeValues = z.infer<typeof employeeSchema>;
const defaultEmployee: EmployeeValues = { firstName: '', lastName: '', email: '', phone: '', branchId: '', departmentId: '', designationId: '', employmentType: 'full_time', status: 'active', dateOfJoining: new Date().toISOString().slice(0, 10), exitDate: '', salary: '0', currency: 'USD', address: '', emergencyContactName: '', emergencyContactPhone: '', notes: '' };

export function EmployeeForm({ initial, branches, departments, designations, onSave, onCancel }: { initial?: Employee; branches: { id: string; name: string }[]; departments: Department[]; designations: Designation[]; employees?: Employee[]; onSave: (value: EmployeeValues) => Promise<void>; onCancel: () => void }) {
  const { currencyCode } = useTenantCurrency();
  const tenantCurrency = currencyCode ?? 'LKR';
  const { register, watch, handleSubmit, formState: { errors, isSubmitting } } = useForm<EmployeeValues>({ resolver: zodResolver(employeeSchema), defaultValues: initial ? { ...defaultEmployee, ...initial, currency: tenantCurrency, status: ['active', 'on_leave', 'terminated', 'resigned'].includes(initial.status) ? initial.status as EmployeeValues['status'] : 'active', salary: String(initial.salary), exitDate: initial.exitDate ?? '', address: initial.address ?? '', emergencyContactName: initial.emergencyContactName ?? '', emergencyContactPhone: initial.emergencyContactPhone ?? '', notes: initial.notes ?? '' } : { ...defaultEmployee, currency: tenantCurrency } });
  const departmentId = watch('departmentId');
  const select = (name: keyof EmployeeValues, label: string, options: { value: string; label: string }[]) => <FormField label={label} required error={errors[name]?.message}><Select {...register(name)} options={[{ value: '', label: `Select ${label.toLowerCase()}` }, ...options]} /></FormField>;
  const input = (name: keyof EmployeeValues, label: string, type = 'text') => <FormField label={label} required={['firstName', 'lastName', 'email', 'phone', 'dateOfJoining', 'salary'].includes(name)} error={errors[name]?.message}>{type === 'date' ? <DatePicker {...register(name)} /> : <TextInput type={type} {...register(name)} readOnly={name === 'currency'} />}</FormField>;
  return <form className="space-y-5" onSubmit={handleSubmit(onSave)}><div className="grid gap-4 sm:grid-cols-2">{input('firstName', 'First name')}{input('lastName', 'Last name')}{input('email', 'Email', 'email')}{input('phone', 'Phone')}{select('branchId', 'Branch', branches.map((row) => ({ value: row.id, label: row.name })))}{select('departmentId', 'Department', departments.filter((row) => row.status === 'active').map((row) => ({ value: row.id, label: row.name })))}{select('designationId', 'Designation', designations.filter((row) => row.departmentId === departmentId && row.status === 'active').map((row) => ({ value: row.id, label: row.name })))}{select('employmentType', 'Employment type', ['full_time', 'part_time', 'contract', 'intern'].map((value) => ({ value, label: value.replace('_', ' ') })))}{select('status', 'Status', ['active', 'on_leave', 'terminated', 'resigned'].map((value) => ({ value, label: value.replace('_', ' ') })))}{input('dateOfJoining', 'Joining date', 'date')}{input('exitDate', 'Exit date', 'date')}{input('salary', 'Base salary', 'number')}{input('currency', 'Currency')}{input('address', 'Address')}{input('emergencyContactName', 'Emergency contact')}{input('emergencyContactPhone', 'Emergency phone')}</div>{input('notes', 'Notes')}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit" isLoading={isSubmitting}>Save employee</Button></div></form>;
}

export type OperationKind = 'shift' | 'roster' | 'attendance' | 'correction' | 'leave' | 'holiday' | 'overtime' | 'payitem' | 'revision' | 'loan' | 'payroll';
export type OperationValues = Record<string, string>;
type Field = { key: string; label: string; type?: 'date' | 'time' | 'number' | 'select'; options?: { value: string; label: string }[] };
const field = (key: string, label: string, type?: Field['type'], options?: Field['options']): Field => ({ key, label, type, options });
const operationSchema = (kind: OperationKind, fields: Field[], employees: Employee[] = []) => z.record(z.string(), z.string()).superRefine((values, context) => {
  for (const item of fields) if (!values[item.key]?.trim()) context.addIssue({ code: 'custom', path: [item.key], message: `${item.label} is required. Please enter a valid value to continue.` });
  for (const item of fields.filter((entry) => entry.type === 'date')) if (values[item.key] && !/^\d{4}-\d{2}-\d{2}$/.test(values[item.key])) context.addIssue({ code: 'custom', path: [item.key], message: `${item.label} must be a valid date. Please enter in YYYY-MM-DD format.` });
  for (const item of fields.filter((entry) => entry.type === 'time')) if (values[item.key] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(values[item.key])) context.addIssue({ code: 'custom', path: [item.key], message: `${item.label} must be a valid time. Please enter in 24-hour HH:MM format (e.g., 09:30).` });
  if (values.startDate && values.endDate && values.endDate < values.startDate) context.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must follow start date. Please select an end date on or after the start date.' });
  if (kind === 'leave' && values.employeeId) {
    const worker = employees.find((row) => row.id === values.employeeId);
    if (worker && (worker.status === 'resigned' || worker.status === 'terminated')) {
      context.addIssue({ code: 'custom', path: ['employeeId'], message: 'Leave applications are not allowed for resigned or terminated employees.' });
    }
  }
  if (kind === 'attendance' && values.employeeId && values.date) {
    const worker = employees.find((row) => row.id === values.employeeId);
    if (worker && worker.status === 'resigned' && worker.exitDate && values.date > worker.exitDate) {
      context.addIssue({ code: 'custom', path: ['date'], message: 'Attendance cannot be marked for resigned employees after their effective resignation date.' });
    }
  }
  if (kind === 'shift' && values.start && values.end) {
    if (values.start === values.end) {
      context.addIssue({ code: 'custom', path: ['end'], message: 'End time cannot be the same as start time.' });
    }
    const [sh, sm] = values.start.split(':').map(Number);
    const [eh, em] = values.end.split(':').map(Number);
    let durationMinutes = (eh * 60 + em) - (sh * 60 + sm);
    if (durationMinutes <= 0) durationMinutes += 24 * 60; // night / overnight shift
    if (values.breakMinutes && Number(values.breakMinutes) >= durationMinutes) {
      context.addIssue({ code: 'custom', path: ['breakMinutes'], message: 'Break time must be less than total shift duration.' });
    }
  }
  if (kind === 'attendance' && values.checkIn && values.checkOut && values.checkOut <= values.checkIn) context.addIssue({ code: 'custom', path: ['checkOut'], message: 'Check-out time must follow check-in time. Please select a check-out time after check-in.' });
  for (const key of ['amount', 'hours', 'salary', 'installments', 'breakMinutes']) if (values[key] && (!Number.isFinite(Number(values[key])) || Number(values[key]) < 0 || (['hours', 'installments'].includes(key) && Number(values[key]) === 0))) context.addIssue({ code: 'custom', path: [key], message: 'Please enter a valid positive number greater than zero.' });
  if (kind === 'payroll' && values.period && !/^\d{4}-(0[1-9]|1[0-2])$/.test(values.period)) context.addIssue({ code: 'custom', path: ['period'], message: 'Payroll period must be in YYYY-MM format. Please enter a valid period (e.g., 2026-11).' });
});
export function OperationForm({ kind, employees, shifts, rosters = [], leaveTypes, attendance, onSave, onCancel }: { kind: OperationKind; employees: Employee[]; shifts: Shift[]; rosters?: Roster[]; leaveTypes: LeaveType[]; attendance: { id: string; date: string; employeeId: string }[]; onSave: (value: OperationValues) => Promise<void>; onCancel: () => void }) {
  const [attachment, setAttachment] = useState<File | null>(null);
  const employeeOptions = employees.map((row) => ({ value: row.id, label: `${row.employeeCode} · ${row.firstName} ${row.lastName}` }));
  const configs: Record<OperationKind, Field[]> = {
    shift: [field('name', 'Shift name'), field('start', 'Start time', 'time'), field('end', 'End time', 'time'), field('breakMinutes', 'Break minutes', 'number')],
    roster: [field('employeeId', 'Employee', 'select', employeeOptions), field('date', 'Date', 'date'), field('shiftId', 'Shift', 'select', shifts.filter((row) => row.active).map((row) => ({ value: row.id, label: row.name })))],
    attendance: [
      field('employeeId', 'Employee', 'select', employeeOptions),
      field('date', 'Date', 'date'),
      field('shiftId', 'Shift', 'select', shifts.filter((row) => row.active).map((row) => ({ value: row.id, label: `${row.name} (${row.start} - ${row.end})` }))),
      field('checkIn', 'Check-in', 'time'),
      field('checkOut', 'Check-out', 'time')
    ],
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
  const schema = operationSchema(kind, fields, employees);
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<OperationValues>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(fields.map((item) => [item.key, item.key === 'date' ? new Date().toISOString().slice(0, 10) : item.key === 'breakMinutes' ? '0' : '']))
  });

  const selectedEmployeeId = watch('employeeId');
  const selectedDate = watch('date');

  useEffect(() => {
    if (kind === 'attendance' && selectedEmployeeId && selectedDate) {
      const assigned = rosters.find((r) => r.employeeId === selectedEmployeeId && r.date === selectedDate);
      if (assigned?.shiftId) {
        setValue('shiftId', assigned.shiftId);
      }
    }
  }, [kind, selectedEmployeeId, selectedDate, rosters, setValue]);

  return <form className="space-y-4" onSubmit={handleSubmit((value) => onSave({ ...value, attachment: attachment?.name ?? '' }))}><div className="grid gap-4 sm:grid-cols-2">{fields.map((item) => <FormField key={item.key} label={item.label} required error={errors[item.key]?.message}>{item.type === 'select' ? <Select {...register(item.key)} options={[{ value: '', label: `Select ${item.label.toLowerCase()}` }, ...(item.options ?? [])]} /> : item.type === 'date' ? <DatePicker {...register(item.key)} /> : <TextInput type={item.type === 'time' ? 'time' : item.type === 'number' ? 'number' : 'text'} min={item.type === 'number' ? '0' : undefined} step={item.type === 'number' ? '0.01' : undefined} {...register(item.key)} />}</FormField>)}</div>{kind === 'leave' && <FormField label="Attachment metadata"><input type="file" className="block w-full text-sm" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} /></FormField>}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit" isLoading={isSubmitting}>Save</Button></div></form>;
}
