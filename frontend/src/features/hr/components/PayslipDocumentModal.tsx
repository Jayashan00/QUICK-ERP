import { Printer, Mail, Download } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';
import { Modal } from '@/shared/components/common/Modal';
import type { Employee } from '../types/employee';

export interface PayslipItem {
  id: string;
  tenantId: string;
  branchId: string;
  period: string;
  status: 'ready' | string;
  employeeId: string;
  base: number;
  allowance: number;
  overtime: number;
  commission: number;
  deduction: number;
  loanRecovery: number;
  contributionBase: number;
  employeeEpf: number;
  employerEpf: number;
  employerEtf: number;
  gross: number;
  net: number;
}

function safeLogoUrl(value?: string): string | undefined {
  const url = value?.trim();
  if (!url) return undefined;
  return /^(?:https?:\/\/|data:image\/(?:png|jpe?g|webp);base64,)/i.test(url) ? url : undefined;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

export function generatePayslipHtml(options: {
  payslip: PayslipItem;
  employee?: Employee;
  companyName?: string;
  companyLogoUrl?: string;
  formatMoney: (amount: number) => string;
}): string {
  const { payslip, employee, formatMoney } = options;
  const companyName = escapeHtml(options.companyName?.trim() || 'Company');
  const companyLogoUrl = safeLogoUrl(options.companyLogoUrl);
  const companyLogo = companyLogoUrl
    ? `<img class="company-logo" src="${escapeHtml(companyLogoUrl)}" alt="${companyName} logo">`
    : '';
  const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : payslip.employeeId;
  const totalDeductions = payslip.deduction + payslip.employeeEpf + payslip.loanRecovery;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Payslip - ${employee?.employeeCode ?? payslip.employeeId} - ${payslip.period}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      background: #f8fafc;
      padding: 30px;
      font-size: 13px;
      line-height: 1.5;
    }
    .payslip-container {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 36px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .company-title {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .company-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .company-logo {
      width: 58px;
      height: 58px;
      object-fit: contain;
      flex: 0 0 auto;
    }
    .company-subtitle {
      color: #64748b;
      font-size: 12px;
      margin-top: 4px;
    }
    .payslip-badge {
      text-align: right;
    }
    .payslip-badge h2 {
      font-size: 20px;
      font-weight: 700;
      color: #2563eb;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .payslip-badge p {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 16px 20px;
      margin-bottom: 28px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-val {
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
      margin-top: 2px;
    }
    .tables-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-size: 12px;
      font-weight: 600;
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid #cbd5e1;
    }
    td {
      padding: 9px 14px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
    }
    td.amount {
      text-align: right;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 500;
    }
    tr.total-row td {
      background: #f8fafc;
      font-weight: 700;
      border-top: 2px solid #e2e8f0;
      border-bottom: none;
      color: #0f172a;
    }
    .net-salary-card {
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      color: #ffffff;
      border-radius: 8px;
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
    }
    .net-salary-card .label {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.9;
    }
    .net-salary-card .net-amount {
      font-size: 26px;
      font-weight: 800;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .statutory-box {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 14px 18px;
      background: #fafafa;
      margin-bottom: 32px;
    }
    .statutory-title {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .statutory-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      font-size: 12px;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 60px;
      margin-top: 40px;
      padding-top: 20px;
    }
    .sign-block {
      border-top: 1px dashed #94a3b8;
      padding-top: 8px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
    .footer {
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      margin-top: 30px;
      padding-top: 16px;
      border-top: 1px solid #f1f5f9;
    }
    @media print {
      body { background: white; padding: 0; }
      .payslip-container { box-shadow: none; border: none; padding: 20px; width: 100%; max-width: 100%; }
      .net-salary-card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="payslip-container">
    <div class="header">
      <div class="company-brand">
        ${companyLogo}
        <div>
          <div class="company-title">${companyName}</div>
          <div class="company-subtitle">Enterprise Human Resources & Payroll · Branch: ${employee?.branchId ?? payslip.branchId}</div>
        </div>
      </div>
      <div class="payslip-badge">
        <h2>Payslip</h2>
        <p>Period: <strong>${payslip.period}</strong></p>
        <p>Ref: <strong>${payslip.id}</strong></p>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Employee Name</span>
        <span class="info-val">${employeeName}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Employee Code</span>
        <span class="info-val">${employee?.employeeCode ?? '—'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Department</span>
        <span class="info-val">${employee?.departmentName ?? 'General'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Designation</span>
        <span class="info-val">${employee?.designationName ?? 'Staff'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Email & Contact</span>
        <span class="info-val">${employee?.email ?? '—'} · ${employee?.phone ?? '—'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Date of Joining / Type</span>
        <span class="info-val">${employee?.dateOfJoining ?? '—'} (${employee?.employmentType ? employee.employmentType.replace('_', ' ') : 'Full time'})</span>
      </div>
    </div>

    <div class="tables-container">
      <div>
        <table>
          <thead>
            <tr>
              <th>Earnings / Allowances</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Basic Salary</td>
              <td class="amount">${formatMoney(payslip.base)}</td>
            </tr>
            <tr>
              <td>Allowances</td>
              <td class="amount">${formatMoney(payslip.allowance)}</td>
            </tr>
            <tr>
              <td>Overtime Pay</td>
              <td class="amount">${formatMoney(payslip.overtime)}</td>
            </tr>
            <tr>
              <td>Sales Commission</td>
              <td class="amount">${formatMoney(payslip.commission)}</td>
            </tr>
            <tr class="total-row">
              <td>Total Gross Salary</td>
              <td class="amount">${formatMoney(payslip.gross)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <table>
          <thead>
            <tr>
              <th>Deductions</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Statutory EPF (Employee 8%)</td>
              <td class="amount">${formatMoney(payslip.employeeEpf)}</td>
            </tr>
            <tr>
              <td>Loan Recovery</td>
              <td class="amount">${formatMoney(payslip.loanRecovery)}</td>
            </tr>
            <tr>
              <td>Other Deductions</td>
              <td class="amount">${formatMoney(payslip.deduction)}</td>
            </tr>
            <tr>
              <td>&nbsp;</td>
              <td class="amount">&nbsp;</td>
            </tr>
            <tr class="total-row">
              <td>Total Deductions</td>
              <td class="amount">${formatMoney(totalDeductions)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="net-salary-card">
      <div class="label">Net Payable Salary</div>
      <div class="net-amount">${formatMoney(payslip.net)}</div>
    </div>

    <div class="statutory-box">
      <div class="statutory-title">Employer Statutory Contributions (Company Cost)</div>
      <div class="statutory-grid">
        <div>EPF/ETF Base: <strong>${formatMoney(payslip.contributionBase)}</strong></div>
        <div>Employer EPF (12%): <strong>${formatMoney(payslip.employerEpf)}</strong></div>
        <div>Employer ETF (3%): <strong>${formatMoney(payslip.employerEtf)}</strong></div>
      </div>
    </div>

    <div class="signatures">
      <div class="sign-block">
        Authorized Signature / HR Department
      </div>
      <div class="sign-block">
        Employee Signature
      </div>
    </div>

    <div class="footer">
      This is a system-generated document from ${companyName} HR & Payroll System.
    </div>
  </div>
</body>
</html>`;
}

export function printPayslipHtml(options: {
  payslip: PayslipItem;
  employee?: Employee;
  companyName?: string;
  companyLogoUrl?: string;
  formatMoney: (amount: number) => string;
}) {
  const html = generatePayslipHtml(options);
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 350);
}

export function downloadPayslipHtml(options: {
  payslip: PayslipItem;
  employee?: Employee;
  companyName?: string;
  companyLogoUrl?: string;
  formatMoney: (amount: number) => string;
}) {
  const html = generatePayslipHtml(options);
  const employeeCode = options.employee?.employeeCode ?? options.payslip.employeeId;
  const fileName = `Payslip-${employeeCode}-${options.payslip.period}.html`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function PayslipDocumentModal({
  isOpen,
  onClose,
  payslip,
  employee,
  companyName,
  companyLogoUrl,
  formatMoney,
  onShareEmail,
}: {
  isOpen: boolean;
  onClose: () => void;
  payslip: PayslipItem | null;
  employee?: Employee;
  companyName?: string;
  companyLogoUrl?: string;
  formatMoney: (amount: number) => string;
  onShareEmail?: (payslip: PayslipItem, employee?: Employee) => void;
}) {
  if (!isOpen || !payslip) return null;

  const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : payslip.employeeId;
  const totalDeductions = payslip.deduction + payslip.employeeEpf + payslip.loanRecovery;

  const handlePrint = () => {
    printPayslipHtml({ payslip, employee, companyName, companyLogoUrl, formatMoney });
  };

  const handleDownload = () => {
    downloadPayslipHtml({ payslip, employee, companyName, companyLogoUrl, formatMoney });
  };

  const handleShare = () => {
    if (onShareEmail) {
      onShareEmail(payslip, employee);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Payslip - ${employee?.employeeCode ?? payslip.employeeId} (${payslip.period})`}
      maxWidth="840px"
    >
      <div className="space-y-4">
        {/* Action Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <p className="text-sm text-slate-600">
            Official Payslip for <span className="font-semibold text-slate-800">{employeeName}</span> ({payslip.period})
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={handlePrint}>
              <Printer size={15} className="mr-1.5" />
              Print
            </Button>
            <Button size="sm" variant="secondary" onClick={handleDownload}>
              <Download size={15} className="mr-1.5" />
              Download
            </Button>
            <Button size="sm" onClick={handleShare}>
              <Mail size={15} className="mr-1.5" />
              Share to email
            </Button>
          </div>
        </div>

        {/* Visual Document Container */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between border-b border-slate-200 pb-5">
            <div className="flex items-center gap-3">
              {safeLogoUrl(companyLogoUrl) && <img src={safeLogoUrl(companyLogoUrl)} alt={`${companyName || 'Company'} logo`} className="size-14 shrink-0 object-contain" />}
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{companyName?.trim() || 'Company'}</h1>
                <p className="mt-1 text-xs text-slate-500">
                  Enterprise Human Resources & Payroll · Branch: {employee?.branchId ?? payslip.branchId}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block rounded-md bg-blue-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-blue-800">
                Payslip
              </span>
              <p className="mt-1.5 text-xs text-slate-500">Period: <strong className="text-slate-800">{payslip.period}</strong></p>
              <p className="text-xs text-slate-400">Ref: {payslip.id}</p>
            </div>
          </div>

          {/* Employee Details Grid */}
          <div className="mt-5 grid grid-cols-2 gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4 text-xs sm:grid-cols-3">
            <div>
              <span className="block font-semibold uppercase tracking-wider text-slate-500">Employee Name</span>
              <span className="mt-0.5 block text-sm font-bold text-slate-800">{employeeName}</span>
            </div>
            <div>
              <span className="block font-semibold uppercase tracking-wider text-slate-500">Employee Code</span>
              <span className="mt-0.5 block text-sm font-semibold text-slate-800">{employee?.employeeCode ?? '—'}</span>
            </div>
            <div>
              <span className="block font-semibold uppercase tracking-wider text-slate-500">Department</span>
              <span className="mt-0.5 block text-sm font-medium text-slate-800">{employee?.departmentName ?? 'General'}</span>
            </div>
            <div>
              <span className="block font-semibold uppercase tracking-wider text-slate-500">Designation</span>
              <span className="mt-0.5 block text-sm font-medium text-slate-800">{employee?.designationName ?? 'Staff'}</span>
            </div>
            <div>
              <span className="block font-semibold uppercase tracking-wider text-slate-500">Email</span>
              <span className="mt-0.5 block text-sm font-medium text-slate-800">{employee?.email ?? '—'}</span>
            </div>
            <div>
              <span className="block font-semibold uppercase tracking-wider text-slate-500">Joining Date</span>
              <span className="mt-0.5 block text-sm font-medium text-slate-800">{employee?.dateOfJoining ?? '—'}</span>
            </div>
          </div>

          {/* Earnings & Deductions Tables */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {/* Earnings */}
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="bg-slate-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                Salary & Allowances (Earnings)
              </div>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-2.5 text-slate-600">Basic Salary</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-800">{formatMoney(payslip.base)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-slate-600">Allowances</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-800">{formatMoney(payslip.allowance)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-slate-600">Overtime Pay</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-800">{formatMoney(payslip.overtime)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-slate-600">Sales Commission</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-800">{formatMoney(payslip.commission)}</td>
                  </tr>
                  <tr className="bg-slate-50 font-bold text-slate-900">
                    <td className="px-4 py-2.5">Total Gross Salary</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatMoney(payslip.gross)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Deductions */}
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="bg-slate-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                Deductions
              </div>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-2.5 text-slate-600">Statutory EPF (Employee 8%)</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-800">{formatMoney(payslip.employeeEpf)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-slate-600">Loan Recovery</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-800">{formatMoney(payslip.loanRecovery)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-slate-600">Other Deductions</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-800">{formatMoney(payslip.deduction)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-slate-400">—</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">—</td>
                  </tr>
                  <tr className="bg-slate-50 font-bold text-slate-900">
                    <td className="px-4 py-2.5">Total Deductions</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatMoney(totalDeductions)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Net Salary Banner */}
          <div className="mt-5 flex items-center justify-between rounded-lg bg-gradient-to-r from-blue-700 to-indigo-700 p-4 text-white shadow-sm">
            <div>
              <span className="block text-xs font-semibold uppercase tracking-wider text-blue-100">Net Payable Salary</span>
              <span className="text-xs text-blue-200">Gross salary minus all statutory and company deductions</span>
            </div>
            <div className="font-mono text-2xl font-extrabold">{formatMoney(payslip.net)}</div>
          </div>

          {/* Statutory Contributions */}
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-xs">
            <span className="block font-bold uppercase tracking-wider text-slate-500">Employer Statutory Contributions (Company Cost)</span>
            <div className="mt-2 grid grid-cols-3 gap-2 text-slate-700">
              <div>EPF/ETF Base: <span className="font-mono font-semibold">{formatMoney(payslip.contributionBase)}</span></div>
              <div>Employer EPF (12%): <span className="font-mono font-semibold">{formatMoney(payslip.employerEpf)}</span></div>
              <div>Employer ETF (3%): <span className="font-mono font-semibold">{formatMoney(payslip.employerEtf)}</span></div>
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-8 grid grid-cols-2 gap-12 pt-6">
            <div className="border-t border-dashed border-slate-300 pt-2 text-center text-xs text-slate-500">
              Authorized Signature / HR Department
            </div>
            <div className="border-t border-dashed border-slate-300 pt-2 text-center text-xs text-slate-500">
              Employee Signature
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-3 text-center text-[11px] text-slate-400">
            This is a computer-generated payslip from {companyName?.trim() || 'Company'} HR & Payroll System.
          </div>
        </div>

        {/* Modal Close Footer */}
        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
