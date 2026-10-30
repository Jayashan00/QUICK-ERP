import {
  ArchiveRestore,
  BadgePercent,
  BellRing,
  BriefcaseBusiness,
  Building,
  CalendarClock,
  CalendarRange,
  CreditCard,
  Fingerprint,
  GitBranch,
  Hash,
  History,
  KeyRound,
  Landmark,
  Languages,
  Mail,
  MessageCircleMore,
  MessageSquareText,
  MonitorPlay,
  Printer,
  ScanBarcode,
  Shield,
  Sliders,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { PERMISSIONS } from '@/core/permissions/permissionConstants';

export interface SettingsNavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  description: string;
  permission?: string;
}

export interface SettingsNavGroup {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  items: SettingsNavItem[];
}

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    id: 'organization',
    label: 'Organization',
    description: 'Company structure, branches, departments, and job titles',
    icon: Building,
    items: [
      {
        label: 'Company Profile',
        path: '/settings/company',
        icon: Building,
        description: 'Manage legal organization identity, address, and branding',
        permission: PERMISSIONS.SETTINGS.COMPANY_VIEW,
      },
      {
        label: 'Branches',
        path: '/settings/branches',
        icon: GitBranch,
        description: 'Configure operational branches, offices, and locations',
        permission: PERMISSIONS.SETTINGS.BRANCHES_VIEW,
      },
      {
        label: 'Departments',
        path: '/settings/departments',
        icon: Users,
        description: 'Organize divisions, departments, and reporting lines',
        permission: PERMISSIONS.SETTINGS.DEPARTMENTS_VIEW,
      },
      {
        label: 'Designations',
        path: '/settings/designations',
        icon: BriefcaseBusiness,
        description: 'Manage job titles and department assignments',
        permission: PERMISSIONS.SETTINGS.DESIGNATIONS_VIEW,
      },
    ],
  },
  {
    id: 'team-access',
    label: 'Team & Access',
    description: 'Users, roles, permissions, and account activity',
    icon: UserCheck,
    items: [
      {
        label: 'Users & Staff',
        path: '/settings/users',
        icon: UserCheck,
        description: 'Team members, account access, and branch assignments',
        permission: PERMISSIONS.SETTINGS.USERS_VIEW,
      },
      {
        label: 'Roles & Permissions',
        path: '/settings/roles',
        icon: Shield,
        description: 'Manage default and custom tenant roles',
        permission: PERMISSIONS.SETTINGS.ROLES_VIEW,
      },
      {
        label: 'Permission Matrix',
        path: '/settings/permissions',
        icon: KeyRound,
        description: 'Assign action-level permissions to tenant roles',
        permission: PERMISSIONS.SETTINGS.PERMISSIONS_VIEW,
      },
      {
        label: 'Login Activity',
        path: '/settings/login-activity',
        icon: History,
        description: 'Review tenant login history, devices, and active sessions',
        permission: PERMISSIONS.SETTINGS.LOGIN_ACTIVITY_VIEW,
      },
    ],
  },
  {
    id: 'general-localization',
    label: 'General & Localization',
    description: 'Regional preferences and document identity',
    icon: Sliders,
    items: [
      {
        label: 'General Settings',
        path: '/settings/preferences',
        icon: Sliders,
        description: 'Timezone, date, language, and company preferences',
        permission: PERMISSIONS.SETTINGS.PREFERENCES_VIEW,
      },
      {
        label: 'Currency & Localization',
        path: '/settings/localization',
        icon: Languages,
        description: 'Currency, locale, precision, and number formats',
        permission: PERMISSIONS.SETTINGS.LOCALIZATION_VIEW,
      },
      {
        label: 'Document Numbering',
        path: '/settings/document-numbering',
        icon: Hash,
        description: 'Document prefixes, counters, padding, and reset rules',
        permission: PERMISSIONS.SETTINGS.DOCUMENT_SETTINGS_VIEW,
      },
    ],
  },
  {
    id: 'finance-payments',
    label: 'Finance & Payments',
    description: 'Accounting calendar, taxes, terms, and settlement details',
    icon: CreditCard,
    items: [
      {
        label: 'Financial Year',
        path: '/settings/financial-year',
        icon: CalendarRange,
        description: 'Financial calendar and accounting period controls',
        permission: PERMISSIONS.SETTINGS.FINANCIAL_YEAR_VIEW,
      },
      {
        label: 'Tax / VAT',
        path: '/settings/taxes',
        icon: BadgePercent,
        description: 'Tax rates, validity dates, and defaults',
        permission: PERMISSIONS.SETTINGS.TAXES_VIEW,
      },
      {
        label: 'Payment Terms',
        path: '/settings/payment-terms',
        icon: CalendarClock,
        description: 'Invoice due dates and the default payment term',
        permission: PERMISSIONS.SETTINGS.PAYMENT_TERMS_VIEW,
      },
      {
        label: 'Payment Methods',
        path: '/settings/payment-methods',
        icon: CreditCard,
        description: 'Accepted methods and payment reference requirements',
        permission: PERMISSIONS.SETTINGS.PAYMENT_METHODS_VIEW,
      },
      {
        label: 'Settlement Bank Account',
        path: '/settings/settlement-bank',
        icon: Landmark,
        description: 'Bank details used for settlement and payout processing',
        permission: PERMISSIONS.INTEGRATIONS.SETTLEMENT_BANK_VIEW,
      },
    ],
  },
  {
    id: 'notifications-channels',
    label: 'Notifications & Channels',
    description: 'Notification preferences and company communication identities',
    icon: BellRing,
    items: [
      {
        label: 'Notification Preferences',
        path: '/settings/notification-preferences',
        icon: BellRing,
        description: 'Optional alert channels grouped by business event',
        permission: PERMISSIONS.SETTINGS.NOTIFICATION_PREFERENCES_VIEW,
      },
      {
        label: 'Email Channel',
        path: '/settings/integrations/email',
        icon: Mail,
        description: 'Sender identity for managed email delivery',
        permission: PERMISSIONS.INTEGRATIONS.EMAIL_INTEGRATION_VIEW,
      },
      {
        label: 'SMS Channel',
        path: '/settings/integrations/sms',
        icon: MessageSquareText,
        description: 'SMS number, sender identity, and notification usage',
        permission: PERMISSIONS.INTEGRATIONS.SMS_INTEGRATION_VIEW,
      },
      {
        label: 'WhatsApp Channel',
        path: '/settings/integrations/whatsapp',
        icon: MessageCircleMore,
        description: 'WhatsApp number, display name, and notification usage',
        permission: PERMISSIONS.INTEGRATIONS.WHATSAPP_INTEGRATION_VIEW,
      },
    ],
  },
  {
    id: 'devices-pos',
    label: 'Devices & POS',
    description: 'Branch hardware and point-of-sale device behavior',
    icon: Printer,
    items: [
      {
        label: 'Barcode Scanner',
        path: '/settings/devices/barcode-scanner',
        icon: ScanBarcode,
        description: 'Branch barcode formats, suffix, and scan behavior',
        permission: PERMISSIONS.DEVICES.BARCODE_SCANNER_VIEW,
      },
      {
        label: 'Printer',
        path: '/settings/devices/printer',
        icon: Printer,
        description: 'Receipt, document, label, and thermal printer behavior',
        permission: PERMISSIONS.DEVICES.PRINTERS_VIEW,
      },
      {
        label: 'Cash Drawer',
        path: '/settings/devices/cash-drawer',
        icon: ArchiveRestore,
        description: 'POS drawer device, printer link, and auto-open rules',
        permission: PERMISSIONS.DEVICES.CASH_DRAWER_VIEW,
      },
      {
        label: 'Customer Display',
        path: '/settings/devices/customer-display',
        icon: MonitorPlay,
        description: 'Customer-facing cart, total, and payment display',
        permission: PERMISSIONS.DEVICES.CUSTOMER_DISPLAY_VIEW,
      },
      {
        label: 'Biometric Device',
        path: '/settings/devices/biometric',
        icon: Fingerprint,
        description: 'Attendance device connection, imports, and synchronization',
        permission: PERMISSIONS.DEVICES.BIOMETRIC_DEVICE_VIEW,
      },
    ],
  },
];
