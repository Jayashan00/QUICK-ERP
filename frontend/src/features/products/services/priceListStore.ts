import { mockPriceLists, mockPriceRules } from '../mocks/priceLists';
import type { PriceList, PriceRule } from '../types/priceList';
import { registerList } from '@/core/persistence/stateRegistry';

export const priceListStore = {
  lists: mockPriceLists.map((item): PriceList => ({ ...item })),
  rules: mockPriceRules.map((item): PriceRule => ({ ...item, tiers: item.tiers.map((tier) => ({ ...tier })) })),
};

// Backend persistence registration (see src/core/persistence).
registerList('products.priceLists', () => priceListStore.lists, (rows) => { priceListStore.lists = rows; });
registerList('products.priceRules', () => priceListStore.rules, (rows) => { priceListStore.rules = rows; });
