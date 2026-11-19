import type { PlatformTenant } from '@/features/platform/types/platform';
import vyroIcon from '@/assets/vyro-icon.png';

export const tenantInvoicePdfService = {
  /**
   * Generates and downloads a clean, professional invoice HTML/PDF file or triggers print.
   */
  generateInvoiceHtml(tenant: PlatformTenant): string {
    const inv = tenant.onboarding?.invoice;
    if (!inv) return '';

    const formatCurrency = (val: number) =>
      `${inv.currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${inv.invoiceNumber} - VYRO</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #1e293b; background: #fff; }
    .header-banner { background: #1e3a8a; color: #fff; padding: 24px 32px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; }
    .brand-wrap { display: flex; align-items: center; gap: 16px; }
    .logo-img { width: 50px; height: 50px; border-radius: 8px; object-fit: contain; background: #ffffff; padding: 3px; }
    .logo { font-size: 26px; font-weight: 800; letter-spacing: 1px; color: #fff; }
    .logo-sub { font-size: 12px; opacity: 0.85; margin-top: 3px; }
    .invoice-meta { text-align: right; }
    .invoice-title { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
    .meta-line { font-size: 12px; opacity: 0.9; margin: 2px 0; }
    .section { margin-top: 32px; }
    .billed-to { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 16px 0; border-bottom: 1px solid #e2e8f0; }
    .billed-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
    .company-name { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    .text-sm { font-size: 13px; color: #475569; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th { background: #f8fafc; color: #475569; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 12px 16px; text-align: left; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
    th.text-right, td.text-right { text-align: right; }
    td { padding: 14px 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    .totals-area { margin-top: 24px; display: flex; justify-content: flex-end; }
    .totals-table { width: 320px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #475569; }
    .grand-total { border-top: 2px solid #1e3a8a; padding-top: 10px; margin-top: 6px; font-size: 16px; font-weight: 800; color: #1e3a8a; }
    .payment-box { margin-top: 36px; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
    .box-title { font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 8px; }
    .payment-text { font-size: 13px; color: #334155; white-space: pre-line; line-height: 1.6; }
    .footer { margin-top: 48px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
    .status-stamp { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; }
    .status-unpaid { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
    .status-paid { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header-banner">
    <div class="brand-wrap">
      <img src="${vyroIcon}" alt="VYRO Logo" class="logo-img" />
      <div>
        <div class="logo">VYRO</div>
        <div class="logo-sub">Enterprise Cloud ERP Platform</div>
      </div>
    </div>
    <div class="invoice-meta">
      <div class="status-stamp status-${inv.status}">${inv.status === 'paid' ? 'PAID' : 'UNPAID'}</div>
      <div class="invoice-title">INVOICE: ${inv.invoiceNumber}</div>
      <div class="meta-line">Issue Date: ${inv.issueDate}</div>
      <div class="meta-line">Due Date: ${inv.dueDate}</div>
    </div>
  </div>

  <div class="section">
    <div class="billed-to">
      <div>
        <div class="billed-title">Billed To</div>
        <div class="company-name">${tenant.name}</div>
        <div class="text-sm">Subdomain: ${tenant.subdomain}.vyro.cloud</div>
        <div class="text-sm">Contact: ${tenant.contactName} (${tenant.ownerEmail})</div>
        <div class="text-sm">Country: ${tenant.country}</div>
      </div>
      <div>
        <div class="billed-title">Subscription Overview</div>
        <div class="text-sm"><strong>Plan:</strong> ${inv.planName.toUpperCase()}</div>
        <div class="text-sm"><strong>Billing Cycle:</strong> ${inv.billingCycle.toUpperCase()}</div>
        <div class="text-sm"><strong>User Limit:</strong> ${tenant.limits.maxUsers} Users</div>
        <div class="text-sm"><strong>Branch Limit:</strong> ${tenant.limits.maxBranches} Branches</div>
        <div class="text-sm"><strong>Enabled Modules:</strong> ${tenant.enabledModules.length} Modules Included</div>
      </div>
    </div>
  </div>

  <div class="section">
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-right">Billing Term</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>VYRO ${inv.planName.toUpperCase()} Subscription</strong><br>
            <span style="color: #64748b; font-size: 12px;">Cloud enterprise ERP access with ${tenant.enabledModules.length} allowed modules</span>
          </td>
          <td class="text-right">${inv.billingCycle}</td>
          <td class="text-right">${formatCurrency(inv.basePrice)}</td>
        </tr>
        ${inv.discountAmount > 0 ? `
        <tr>
          <td colspan="2" style="color: #059669;">Special Promotional Discount</td>
          <td class="text-right" style="color: #059669;">-${formatCurrency(inv.discountAmount)}</td>
        </tr>` : ''}
        ${inv.additionalCharges > 0 ? `
        <tr>
          <td colspan="2">Setup & Onboarding Services</td>
          <td class="text-right">${formatCurrency(inv.additionalCharges)}</td>
        </tr>` : ''}
        ${inv.taxAmount > 0 ? `
        <tr>
          <td colspan="2">Taxes (${inv.taxRatePercent}%)</td>
          <td class="text-right">${formatCurrency(inv.taxAmount)}</td>
        </tr>` : ''}
      </tbody>
    </table>

    <div class="totals-area">
      <div class="totals-table">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>${formatCurrency(inv.basePrice - inv.discountAmount + inv.additionalCharges)}</span>
        </div>
        ${inv.taxAmount > 0 ? `
        <div class="totals-row">
          <span>Taxes</span>
          <span>${formatCurrency(inv.taxAmount)}</span>
        </div>` : ''}
        <div class="totals-row grand-total">
          <span>Total Amount</span>
          <span>${formatCurrency(inv.totalAmount)}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="payment-box">
    <div class="box-title">Payment Instructions</div>
    <div class="payment-text">${inv.paymentInstructions}</div>
  </div>

  <div class="footer">
    VYRO Cloud ERP · Quick Solutions (Pvt) Ltd · support@vyro.cloud · www.vyro.cloud<br>
    <em>Account access will be activated upon confirmed payment receipt.</em>
  </div>
</body>
</html>`;
  },

  previewAndPrint(tenant: PlatformTenant) {
    const html = this.generateInvoiceHtml(tenant);
    if (!html) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  },

  downloadInvoiceFile(tenant: PlatformTenant) {
    const html = this.generateInvoiceHtml(tenant);
    if (!html) return;
    const inv = tenant.onboarding?.invoice;
    const filename = `${inv?.invoiceNumber || 'Invoice'}-${tenant.subdomain}.html`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
