// import.meta.env is provided by Vite. The fallback keeps this module loadable
// from the Node-based QA scripts, where import.meta.env is not defined.
const viteEnv: Partial<ImportMetaEnv> = import.meta.env ?? {};

export const env = {
  appName: viteEnv.VITE_APP_NAME || 'Quick ERP',
  appEnv: viteEnv.VITE_APP_ENV || 'development',
  apiBaseUrl: viteEnv.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  // Mock mode stays the default. Set VITE_USE_MOCKS="false" to use the Spring Boot backend.
  useMocks: String(viteEnv.VITE_USE_MOCKS ?? 'true').toLowerCase() !== 'false',
  isDev: Boolean(viteEnv.DEV),
  isProd: Boolean(viteEnv.PROD),
};
