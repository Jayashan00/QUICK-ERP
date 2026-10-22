import { env } from './environment';

export interface AppConfig {
  name: string;
  version: string;
  companyName: string;
  supportEmail: string;
  documentationUrl: string;
  enableMultiBranch: boolean;
  defaultLocale: string;
}

export const appConfig: AppConfig = {
  name: env.appName,
  version: '1.0.0-alpha',
  companyName: 'Quick ERP Systems Inc.',
  supportEmail: 'support@quickerp.internal',
  documentationUrl: 'https://docs.quickerp.internal',
  enableMultiBranch: true,
  defaultLocale: 'en-US',
};
