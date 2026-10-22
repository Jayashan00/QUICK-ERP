import type { TenantBranchScope } from '@/core/tenant/dataScope';
import { tenantSettingsService } from '@/features/settings/finance/services/tenantSettingsService';
import { priceListFormSchema, priceRuleFormSchema, type PriceListFormValues, type PriceRuleFormValues } from '../schemas/priceListSchema';
import type { PriceList, PriceListFilters, PriceListListItem, PriceListStatus, PriceRule, PriceRuleListItem, ResolvedProductPrice } from '../types/priceList';
import { productService } from './productService';
import { productVariantService } from './productVariantService';
import { priceListStore } from './priceListStore';

const wait = (duration = 120) => new Promise((resolve) => globalThis.setTimeout(resolve, duration));

function requireTenant(tenantId: string) {
  if (!tenantId.trim()) throw new Error('Tenant context is required.');
  return tenantId;
}

function cloneList(item: PriceList): PriceList {
  return { ...item };
}

function cloneRule(item: PriceRule): PriceRule {
  return { ...item, tiers: item.tiers.map((tier) => ({ ...tier })) };
}

function requireList(tenantId: string, id: string) {
  requireTenant(tenantId);
  const list = priceListStore.lists.find((item) => item.tenantId === tenantId && item.id === id);
  if (!list) throw new Error('Price list not found.');
  return list;
}

function assertUniqueList(tenantId: string, values: { name: string; code: string }, excludeId?: string) {
  const duplicate = priceListStore.lists.find((item) => item.tenantId === tenantId && item.id !== excludeId && (
    item.name.toLocaleLowerCase() === values.name.toLocaleLowerCase() ||
    item.code.toLocaleLowerCase() === values.code.toLocaleLowerCase()
  ));
  if (duplicate) throw new Error(duplicate.code.toLocaleLowerCase() === values.code.toLocaleLowerCase() ? 'A price list with this code already exists.' : 'A price list with this name already exists.');
}

function toListItem(item: PriceList): PriceListListItem {
  const rules = priceListStore.rules.filter((rule) => rule.tenantId === item.tenantId && rule.priceListId === item.id);
  return {
    ...cloneList(item),
    productCount: new Set(rules.map((rule) => rule.productId)).size,
    ruleCount: rules.reduce((total, rule) => total + (rule.pricingType === 'fixed' ? 1 : rule.tiers.length), 0),
  };
}

async function enrichRule(scope: TenantBranchScope, rule: PriceRule): Promise<PriceRuleListItem> {
  const product = await productService.getById(scope, rule.productId);
  if (!product) throw new Error('A product assigned to this price list is unavailable.');
  const variant = rule.variantId
    ? (await productVariantService.getAll(scope.tenantId, rule.productId)).find((item) => item.id === rule.variantId)
    : undefined;
  if (rule.variantId && !variant) throw new Error('A variant assigned to this price list is unavailable.');
  return {
    ...cloneRule(rule),
    productName: product.name,
    productSku: product.sku,
    productStatus: product.status,
    variantLabel: variant?.attributes.map((attribute) => `${attribute.attributeName}: ${attribute.value}`).join(' / '),
    variantSku: variant?.sku,
    defaultSellingPrice: variant?.effectiveSellingPrice ?? product.sellingPrice,
  };
}

function isEffective(list: PriceList, date: string) {
  return list.status === 'active' && (!list.effectiveStartDate || list.effectiveStartDate <= date) && (!list.effectiveEndDate || list.effectiveEndDate >= date);
}

export const priceListService = {
  async getAll(tenantId: string, filters: PriceListFilters = {}) {
    await wait();
    requireTenant(tenantId);
    const search = filters.search?.trim().toLocaleLowerCase();
    let records = priceListStore.lists.filter((item) => item.tenantId === tenantId);
    if (search) records = records.filter((item) => [item.name, item.code, item.description, item.currency].some((value) => value?.toLocaleLowerCase().includes(search)));
    if (filters.status && filters.status !== 'all') records = records.filter((item) => item.status === filters.status);
    if (filters.type && filters.type !== 'all') records = records.filter((item) => item.type === filters.type);
    records = [...records].sort((left, right) => left.name.localeCompare(right.name));
    const total = records.length;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 10;
    return { data: records.slice((page - 1) * pageSize, page * pageSize).map(toListItem), total, page, pageSize };
  },

  async getById(tenantId: string, id: string): Promise<PriceListListItem | null> {
    await wait();
    requireTenant(tenantId);
    const item = priceListStore.lists.find((list) => list.tenantId === tenantId && list.id === id);
    return item ? toListItem(item) : null;
  },

  async create(tenantId: string, values: PriceListFormValues): Promise<PriceList> {
    await wait(180);
    requireTenant(tenantId);
    const parsed = priceListFormSchema.parse(values);
    const localization = await tenantSettingsService.getLocalization(tenantId);
    if (parsed.currency !== localization.baseCurrency) throw new Error('Price list currency must match the tenant base currency.');
    assertUniqueList(tenantId, parsed);
    const now = new Date().toISOString();
    const item: PriceList = {
      id: `price-list-${crypto.randomUUID().slice(0, 8)}`,
      tenantId,
      ...parsed,
      description: parsed.description || undefined,
      effectiveStartDate: parsed.effectiveStartDate || undefined,
      effectiveEndDate: parsed.effectiveEndDate || undefined,
      createdAt: now,
      updatedAt: now,
    };
    priceListStore.lists.push(item);
    return cloneList(item);
  },

  async update(tenantId: string, id: string, values: PriceListFormValues): Promise<PriceList> {
    await wait(180);
    const existing = requireList(tenantId, id);
    const parsed = priceListFormSchema.parse(values);
    const localization = await tenantSettingsService.getLocalization(tenantId);
    if (parsed.currency !== localization.baseCurrency) throw new Error('Price list currency must match the tenant base currency.');
    assertUniqueList(tenantId, parsed, id);
    const updated: PriceList = {
      ...existing,
      ...parsed,
      description: parsed.description || undefined,
      effectiveStartDate: parsed.effectiveStartDate || undefined,
      effectiveEndDate: parsed.effectiveEndDate || undefined,
      updatedAt: new Date().toISOString(),
    };
    priceListStore.lists.splice(priceListStore.lists.indexOf(existing), 1, updated);
    return cloneList(updated);
  },

  async setStatus(tenantId: string, id: string, status: Exclude<PriceListStatus, 'archived'>): Promise<PriceList> {
    await wait();
    const existing = requireList(tenantId, id);
    const updated = { ...existing, status, updatedAt: new Date().toISOString() };
    priceListStore.lists.splice(priceListStore.lists.indexOf(existing), 1, updated);
    return cloneList(updated);
  },

  async archive(tenantId: string, id: string): Promise<PriceList> {
    await wait();
    const existing = requireList(tenantId, id);
    const updated = { ...existing, status: 'archived' as const, updatedAt: new Date().toISOString() };
    priceListStore.lists.splice(priceListStore.lists.indexOf(existing), 1, updated);
    return cloneList(updated);
  },

  async remove(tenantId: string, id: string): Promise<void> {
    await wait();
    const existing = requireList(tenantId, id);
    if (priceListStore.rules.some((rule) => rule.tenantId === tenantId && rule.priceListId === id)) {
      throw new Error('This price list has pricing rules. Archive it instead of deleting it.');
    }
    priceListStore.lists.splice(priceListStore.lists.indexOf(existing), 1);
  },

  async getRules(scope: TenantBranchScope, priceListId: string): Promise<PriceRuleListItem[]> {
    await wait();
    requireList(scope.tenantId, priceListId);
    return Promise.all(priceListStore.rules
      .filter((rule) => rule.tenantId === scope.tenantId && rule.priceListId === priceListId)
      .map((rule) => enrichRule(scope, rule)));
  },

  async createRule(scope: TenantBranchScope, priceListId: string, values: PriceRuleFormValues): Promise<PriceRule> {
    await wait(180);
    requireList(scope.tenantId, priceListId);
    const parsed = priceRuleFormSchema.parse(values);
    const product = await productService.getById(scope, parsed.productId);
    if (!product) throw new Error('Select a product from the active tenant.');
    if (parsed.variantId) {
      const variant = (await productVariantService.getAll(scope.tenantId, parsed.productId)).find((item) => item.id === parsed.variantId);
      if (!variant) throw new Error('Select a variant that belongs to this product.');
    }
    const duplicate = priceListStore.rules.some((rule) => rule.tenantId === scope.tenantId && rule.priceListId === priceListId && rule.productId === parsed.productId && (rule.variantId ?? '') === (parsed.variantId ?? ''));
    if (duplicate) throw new Error('A pricing rule already exists for this product or variant in the price list.');
    const now = new Date().toISOString();
    const rule: PriceRule = {
      id: `price-rule-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      priceListId,
      productId: parsed.productId,
      variantId: parsed.variantId || undefined,
      pricingType: parsed.pricingType,
      fixedPrice: parsed.pricingType === 'fixed' ? parsed.fixedPrice : undefined,
      tiers: parsed.pricingType === 'quantity_tier' ? parsed.tiers.map((tier) => ({ ...tier, id: tier.id || `price-tier-${crypto.randomUUID().slice(0, 8)}` })) : [],
      createdAt: now,
      updatedAt: now,
    };
    priceListStore.rules.push(rule);
    return cloneRule(rule);
  },

  async updateRule(scope: TenantBranchScope, priceListId: string, id: string, values: PriceRuleFormValues): Promise<PriceRule> {
    await wait(180);
    requireList(scope.tenantId, priceListId);
    const existing = priceListStore.rules.find((rule) => rule.tenantId === scope.tenantId && rule.priceListId === priceListId && rule.id === id);
    if (!existing) throw new Error('Pricing rule not found.');
    const parsed = priceRuleFormSchema.parse(values);
    const product = await productService.getById(scope, parsed.productId);
    if (!product) throw new Error('Select a product from the active tenant.');
    if (parsed.variantId && !(await productVariantService.getAll(scope.tenantId, parsed.productId)).some((item) => item.id === parsed.variantId)) throw new Error('Select a variant that belongs to this product.');
    const duplicate = priceListStore.rules.some((rule) => rule.tenantId === scope.tenantId && rule.priceListId === priceListId && rule.id !== id && rule.productId === parsed.productId && (rule.variantId ?? '') === (parsed.variantId ?? ''));
    if (duplicate) throw new Error('A pricing rule already exists for this product or variant in the price list.');
    const updated: PriceRule = {
      ...existing,
      productId: parsed.productId,
      variantId: parsed.variantId || undefined,
      pricingType: parsed.pricingType,
      fixedPrice: parsed.pricingType === 'fixed' ? parsed.fixedPrice : undefined,
      tiers: parsed.pricingType === 'quantity_tier' ? parsed.tiers.map((tier) => ({ ...tier, id: tier.id || `price-tier-${crypto.randomUUID().slice(0, 8)}` })) : [],
      updatedAt: new Date().toISOString(),
    };
    priceListStore.rules.splice(priceListStore.rules.indexOf(existing), 1, updated);
    return cloneRule(updated);
  },

  async removeRule(tenantId: string, priceListId: string, id: string): Promise<void> {
    await wait();
    requireList(tenantId, priceListId);
    const index = priceListStore.rules.findIndex((rule) => rule.tenantId === tenantId && rule.priceListId === priceListId && rule.id === id);
    if (index < 0) throw new Error('Pricing rule not found.');
    priceListStore.rules.splice(index, 1);
  },

  async getExportRows(tenantId: string, filters: Omit<PriceListFilters, 'page' | 'pageSize'> = {}) {
    const result = await priceListService.getAll(tenantId, { ...filters, page: 1, pageSize: Number.MAX_SAFE_INTEGER });
    return result.data;
  },

  /** Reusable pricing handoff for future POS and storefront modules. */
  async resolvePrice(scope: TenantBranchScope, input: { priceListId?: string; productId: string; variantId?: string; quantity: number; date?: string }): Promise<ResolvedProductPrice> {
    requireTenant(scope.tenantId);
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error('Quantity must be greater than zero.');
    const product = await productService.getById(scope, input.productId);
    if (!product) throw new Error('Product not found.');
    const variant = input.variantId ? (await productVariantService.getAll(scope.tenantId, input.productId)).find((item) => item.id === input.variantId) : undefined;
    if (input.variantId && !variant) throw new Error('Variant not found.');
    const localization = await tenantSettingsService.getLocalization(scope.tenantId);
    const fallback: ResolvedProductPrice = {
      productId: product.id,
      variantId: variant?.id,
      quantity: input.quantity,
      price: variant?.effectiveSellingPrice ?? product.sellingPrice,
      source: variant ? 'variant_default' : 'product_default',
      currency: input.priceListId ? requireList(scope.tenantId, input.priceListId).currency : localization.baseCurrency,
    };
    if (!input.priceListId) return fallback;
    const list = requireList(scope.tenantId, input.priceListId);
    if (!isEffective(list, input.date ?? new Date().toISOString().slice(0, 10))) return { ...fallback, currency: list.currency };
    const exactRule = priceListStore.rules.find((item) => item.tenantId === scope.tenantId && item.priceListId === list.id && item.productId === product.id && (item.variantId ?? '') === (variant?.id ?? ''));
    const rule = exactRule ?? (variant ? priceListStore.rules.find((item) => item.tenantId === scope.tenantId && item.priceListId === list.id && item.productId === product.id && !item.variantId) : undefined);
    if (!rule) return { ...fallback, currency: list.currency };
    if (rule.pricingType === 'fixed' && rule.fixedPrice !== undefined) return { ...fallback, priceListId: list.id, price: rule.fixedPrice, source: 'price_list_fixed', currency: list.currency, ruleId: rule.id };
    const tier = rule.tiers.find((item) => input.quantity >= item.minQuantity && (item.maxQuantity === undefined || input.quantity <= item.maxQuantity));
    return tier ? { ...fallback, priceListId: list.id, price: tier.price, source: 'price_list_tier', currency: list.currency, ruleId: rule.id, tierId: tier.id } : { ...fallback, currency: list.currency };
  },
};
