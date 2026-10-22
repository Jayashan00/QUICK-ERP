import { z } from 'zod';
import type { TenantBranchScope } from '@/core/tenant/dataScope';
import { integrationSettingsService } from '@/features/settings/integrations/services/integrationSettingsService';
import { storefrontService } from '@/features/storefront/storefrontService';
import { posService } from './posService';
import { registerList, replaceArray } from '@/core/persistence/stateRegistry';

export type ReceiptChannel = 'email' | 'sms' | 'whatsapp';
export type ReceiptSource = 'pos' | 'storefront';
export type ReceiptMessage = { id: string; tenantId: string; branchId: string; source: ReceiptSource; saleId: string; channel: ReceiptChannel; recipient: string; body: string; status: 'mock_sent'; sentAt: string; sentBy: string };
const messages: ReceiptMessage[] = [];
const schema = z.object({ channel: z.enum(['email', 'sms', 'whatsapp']), recipient: z.string().trim().min(1) });

export const receiptMessageService = {
  async channels(tenantId: string) {
    if (!tenantId) return { email: false, sms: false, whatsapp: false };
    const [email, sms, whatsapp] = await Promise.all([integrationSettingsService.getEmail(tenantId), integrationSettingsService.getSms(tenantId), integrationSettingsService.getWhatsApp(tenantId)]);
    return { email: email.enabled && email.serviceIncluded, sms: sms.enabled && sms.serviceIncluded && sms.useForNotifications, whatsapp: whatsapp.enabled && whatsapp.serviceIncluded && whatsapp.useForNotifications };
  },
  preview(scope: TenantBranchScope, source: ReceiptSource, saleId: string) {
    if (source === 'pos') {
      const sale = posService.sales(scope).find(row => row.id === saleId);
      if (!sale) throw new Error('Receipt is unavailable in this branch.');
      return `Receipt ${saleId.slice(0, 8)} | ${new Date(sale.at).toLocaleString()}\n${sale.lines.map(row => `${row.name} x ${row.quantity}`).join('\n')}\nTotal: LKR ${(sale.total + sale.giftUsed + sale.loyaltyUsed).toFixed(2)}`;
    }
    const order = storefrontService.listForStaff(scope).find(row => row.id === saleId);
    if (!order) throw new Error('Receipt is unavailable in this branch.');
    return `Order ${saleId.slice(0, 8)} | ${new Date(order.createdAt).toLocaleString()}\n${order.items.map(row => `${row.name} x ${row.quantity}`).join('\n')}\nTotal: LKR ${order.total.toFixed(2)}\nStatus: ${order.status}`;
  },
  async send(scope: TenantBranchScope, permittedBranchIds: string[], actor: string, source: ReceiptSource, saleId: string, input: { channel: ReceiptChannel; recipient: string }) {
    if (!scope.tenantId || !permittedBranchIds.includes(scope.branchId)) throw new Error('Receipt branch is not permitted.');
    const parsed = schema.parse(input);
    const recipient = parsed.recipient;
    if (parsed.channel === 'email' ? !z.email().safeParse(recipient).success : recipient.replace(/\D/g, '').length < 7) throw new Error(parsed.channel === 'email' ? 'Enter a valid email address.' : 'Enter a valid phone number.');
    const available = await this.channels(scope.tenantId);
    if (!available[parsed.channel]) throw new Error(`Enable the ${parsed.channel} channel in tenant integration settings first.`);
    const body = this.preview(scope, source, saleId);
    const message: ReceiptMessage = { id: crypto.randomUUID(), tenantId: scope.tenantId, branchId: scope.branchId, source, saleId, channel: parsed.channel, recipient, body, status: 'mock_sent', sentAt: new Date().toISOString(), sentBy: actor };
    messages.unshift(message);
    return message;
  },
  history(scope: TenantBranchScope, source: ReceiptSource, saleId: string) { return messages.filter(row => row.tenantId === scope.tenantId && row.branchId === scope.branchId && row.source === source && row.saleId === saleId).map(row => ({ ...row })); },
};

// Backend persistence registration (see src/core/persistence).
registerList('pos.receiptMessages', () => messages, (rows) => replaceArray(messages, rows));
