export const APP_CONSTANTS = {
  APP_NAME: 'Quick ERP',
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
  DATE_FORMAT: 'YYYY-MM-DD',
  DEFAULT_CURRENCY: 'USD',
  STORAGE_KEYS: {
    MOCK_SESSION: 'quick_erp_mock_session',
    AUTH_TOKEN: 'quick_erp_token',
    USER: 'quick_erp_user',
    TENANT: 'quick_erp_tenant',
    BRANCH: 'quick_erp_branch',
    SIDEBAR_COLLAPSED: 'quick_erp_sidebar_collapsed',
  },
} as const;
