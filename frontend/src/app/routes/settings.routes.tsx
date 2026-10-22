import { Navigate, type RouteObject } from 'react-router-dom';
import type { ComponentType } from 'react';
import { RequirePermission } from '@/core/permissions/components';
import { TENANT_PERMISSIONS as PERMISSIONS } from '@/core/permissions';
import { SettingsLayout } from '@/features/settings/components/SettingsLayout';
import { lazyPage } from './lazyPage';

const settingsPage = <T extends Record<string, unknown>>(loader: () => Promise<T>, name: keyof T) =>
  lazyPage(() => loader().then((module) => ({ default: module[name] as ComponentType })));

const SettingsLandingPage = settingsPage(() => import('@/features/settings'), 'SettingsLandingPage');
const CompanyProfilePage = settingsPage(() => import('@/features/settings/company'), 'CompanyProfilePage');
const BranchListPage = settingsPage(() => import('@/features/settings/branches'), 'BranchListPage');
const BranchFormPage = settingsPage(() => import('@/features/settings/branches'), 'BranchFormPage');
const BranchDetailPage = settingsPage(() => import('@/features/settings/branches'), 'BranchDetailPage');
const DepartmentListPage = settingsPage(() => import('@/features/settings/organization'), 'DepartmentListPage');
const DepartmentFormPage = settingsPage(() => import('@/features/settings/organization'), 'DepartmentFormPage');
const DepartmentDetailPage = settingsPage(() => import('@/features/settings/organization'), 'DepartmentDetailPage');
const DesignationListPage = settingsPage(() => import('@/features/settings/organization'), 'DesignationListPage');
const DesignationFormPage = settingsPage(() => import('@/features/settings/organization'), 'DesignationFormPage');
const DesignationDetailPage = settingsPage(() => import('@/features/settings/organization'), 'DesignationDetailPage');
const UserListPage = settingsPage(() => import('@/features/settings/users'), 'UserListPage');
const UserFormPage = settingsPage(() => import('@/features/settings/users'), 'UserFormPage');
const UserDetailPage = settingsPage(() => import('@/features/settings/users'), 'UserDetailPage');
const RoleListPage = settingsPage(() => import('@/features/settings/roles'), 'RoleListPage');
const RoleFormPage = settingsPage(() => import('@/features/settings/roles'), 'RoleFormPage');
const RoleDetailPage = settingsPage(() => import('@/features/settings/roles'), 'RoleDetailPage');
const PermissionMatrixPage = settingsPage(() => import('@/features/settings/roles'), 'PermissionMatrixPage');
const GeneralSettingsPage = settingsPage(() => import('@/features/settings/finance'), 'GeneralSettingsPage');
const LocalizationSettingsPage = settingsPage(() => import('@/features/settings/finance'), 'LocalizationSettingsPage');
const FinancialSettingsPage = settingsPage(() => import('@/features/settings/finance'), 'FinancialSettingsPage');
const TaxSettingsPage = settingsPage(() => import('@/features/settings/finance'), 'TaxSettingsPage');
const PaymentTermsPage = settingsPage(() => import('@/features/settings/finance'), 'PaymentTermsPage');
const PaymentMethodsPage = settingsPage(() => import('@/features/settings/finance'), 'PaymentMethodsPage');
const DocumentNumberingPage = settingsPage(() => import('@/features/settings/finance'), 'DocumentNumberingPage');
const NotificationPreferencesPage = settingsPage(() => import('@/features/settings/finance'), 'NotificationPreferencesPage');
const EmailIntegrationPage = settingsPage(() => import('@/features/settings/integrations'), 'EmailIntegrationPage');
const SmsIntegrationPage = settingsPage(() => import('@/features/settings/integrations'), 'SmsIntegrationPage');
const WhatsAppIntegrationPage = settingsPage(() => import('@/features/settings/integrations'), 'WhatsAppIntegrationPage');
const SettlementBankAccountPage = settingsPage(() => import('@/features/settings/integrations'), 'SettlementBankAccountPage');
const BarcodeScannerSettingsPage = settingsPage(() => import('@/features/settings/devices'), 'BarcodeScannerSettingsPage');
const PrinterSettingsPage = settingsPage(() => import('@/features/settings/devices'), 'PrinterSettingsPage');
const CashDrawerSettingsPage = settingsPage(() => import('@/features/settings/devices'), 'CashDrawerSettingsPage');
const CustomerDisplaySettingsPage = settingsPage(() => import('@/features/settings/devices'), 'CustomerDisplaySettingsPage');
const BiometricDeviceSettingsPage = settingsPage(() => import('@/features/settings/devices'), 'BiometricDeviceSettingsPage');
const LoginActivityPage = settingsPage(() => import('@/features/settings/security'), 'LoginActivityPage');

export const settingsRoutes: RouteObject[] = [
// Settings
{
  path: 'settings',
  element: (
    <RequirePermission
      modulePrefix="settings"
      deniedMessage="You don't have permission to access settings."
    >
      <SettingsLayout />
    </RequirePermission>
  ),
  children: [
    { index: true, element: <SettingsLandingPage /> },
    {
      path: 'company',
      element: (
        <RequirePermission
          permission={PERMISSIONS.SETTINGS.COMPANY_VIEW}
          deniedMessage="You don't have permission to view company settings."
        >
          <CompanyProfilePage />
        </RequirePermission>
      ),
    },
    {
      path: 'branches',
      element: (
        <RequirePermission
          permission={PERMISSIONS.SETTINGS.BRANCHES_VIEW}
          deniedMessage="You don't have permission to view branches."
        >
          <BranchListPage />
        </RequirePermission>
      ),
    },
    {
      path: 'branches/new',
      element: (
        <RequirePermission
          permission={PERMISSIONS.SETTINGS.BRANCHES_CREATE}
          deniedMessage="You don't have permission to create branches."
        >
          <BranchFormPage />
        </RequirePermission>
      ),
    },
    {
      path: 'branches/:id',
      element: (
        <RequirePermission
          permission={PERMISSIONS.SETTINGS.BRANCHES_VIEW}
          deniedMessage="You don't have permission to view this branch."
        >
          <BranchDetailPage />
        </RequirePermission>
      ),
    },
    {
      path: 'branches/:id/edit',
      element: (
        <RequirePermission
          permission={PERMISSIONS.SETTINGS.BRANCHES_EDIT}
          deniedMessage="You don't have permission to edit branches."
        >
          <BranchFormPage />
        </RequirePermission>
      ),
    },
    {
      path: 'departments',
      element: (
        <RequirePermission
          permission={PERMISSIONS.SETTINGS.DEPARTMENTS_VIEW}
          deniedMessage="You don't have permission to view departments."
        >
          <DepartmentListPage />
        </RequirePermission>
      ),
    },
    {
      path: 'departments/new',
      element: (
        <RequirePermission
          permission={PERMISSIONS.SETTINGS.DEPARTMENTS_CREATE}
          deniedMessage="You don't have permission to create departments."
        >
          <DepartmentFormPage />
        </RequirePermission>
      ),
    },
    {
      path: 'departments/:id',
      element: (
        <RequirePermission
          permission={PERMISSIONS.SETTINGS.DEPARTMENTS_VIEW}
          deniedMessage="You don't have permission to view this department."
        >
          <DepartmentDetailPage />
        </RequirePermission>
      ),
    },
    {
      path: 'departments/:id/edit',
      element: (
        <RequirePermission
          permission={PERMISSIONS.SETTINGS.DEPARTMENTS_EDIT}
          deniedMessage="You don't have permission to edit departments."
        >
          <DepartmentFormPage />
        </RequirePermission>
      ),
    },
    {
      path: 'designations',
      element: <RequirePermission permission={PERMISSIONS.SETTINGS.DESIGNATIONS_VIEW}><DesignationListPage /></RequirePermission>,
    },
    {
      path: 'designations/new',
      element: <RequirePermission permission={PERMISSIONS.SETTINGS.DESIGNATIONS_CREATE}><DesignationFormPage /></RequirePermission>,
    },
    {
      path: 'designations/:id',
      element: <RequirePermission permission={PERMISSIONS.SETTINGS.DESIGNATIONS_VIEW}><DesignationDetailPage /></RequirePermission>,
    },
    {
      path: 'designations/:id/edit',
      element: <RequirePermission permission={PERMISSIONS.SETTINGS.DESIGNATIONS_EDIT}><DesignationFormPage /></RequirePermission>,
    },
    {
      path: 'users',
      element: <RequirePermission permission={PERMISSIONS.SETTINGS.USERS_VIEW}><UserListPage /></RequirePermission>,
    },
    {
      path: 'users/new',
      element: <RequirePermission permission={PERMISSIONS.SETTINGS.USERS_CREATE}><UserFormPage /></RequirePermission>,
    },
    {
      path: 'users/:id',
      element: <RequirePermission permission={PERMISSIONS.SETTINGS.USERS_VIEW}><UserDetailPage /></RequirePermission>,
    },
    {
      path: 'users/:id/edit',
      element: <RequirePermission permission={PERMISSIONS.SETTINGS.USERS_EDIT}><UserFormPage /></RequirePermission>,
    },
    {
      path: 'roles',
      element: <RequirePermission permission={PERMISSIONS.SETTINGS.ROLES_VIEW}><RoleListPage /></RequirePermission>,
    },
    {
      path: 'roles/new',
      element: <RequirePermission permission={PERMISSIONS.SETTINGS.ROLES_CREATE}><RoleFormPage /></RequirePermission>,
    },
    {
      path: 'roles/:id',
      element: <RequirePermission permission={PERMISSIONS.SETTINGS.ROLES_VIEW}><RoleDetailPage /></RequirePermission>,
    },
    {
      path: 'roles/:id/edit',
      element: <RequirePermission permission={PERMISSIONS.SETTINGS.ROLES_EDIT}><RoleFormPage /></RequirePermission>,
    },
    {
      path: 'permissions',
      element: <RequirePermission permission={PERMISSIONS.SETTINGS.PERMISSIONS_VIEW}><PermissionMatrixPage /></RequirePermission>,
    },
    {
      path: 'preferences',
      element: <RequirePermission permission={PERMISSIONS.SETTINGS.PREFERENCES_VIEW}><GeneralSettingsPage /></RequirePermission>,
    },
    { path: 'localization', element: <RequirePermission permission={PERMISSIONS.SETTINGS.LOCALIZATION_VIEW}><LocalizationSettingsPage /></RequirePermission> },
    { path: 'financial-year', element: <RequirePermission permission={PERMISSIONS.SETTINGS.FINANCIAL_YEAR_VIEW}><FinancialSettingsPage /></RequirePermission> },
    { path: 'taxes', element: <RequirePermission permission={PERMISSIONS.SETTINGS.TAXES_VIEW}><TaxSettingsPage /></RequirePermission> },
    { path: 'payment-terms', element: <RequirePermission permission={PERMISSIONS.SETTINGS.PAYMENT_TERMS_VIEW}><PaymentTermsPage /></RequirePermission> },
    { path: 'payment-methods', element: <RequirePermission permission={PERMISSIONS.SETTINGS.PAYMENT_METHODS_VIEW}><PaymentMethodsPage /></RequirePermission> },
    { path: 'document-numbering', element: <RequirePermission permission={PERMISSIONS.SETTINGS.DOCUMENT_SETTINGS_VIEW}><DocumentNumberingPage /></RequirePermission> },
    { path: 'notification-preferences', element: <RequirePermission permission={PERMISSIONS.SETTINGS.NOTIFICATION_PREFERENCES_VIEW}><NotificationPreferencesPage /></RequirePermission> },
    { path: 'integrations/email', element: <RequirePermission permission={PERMISSIONS.INTEGRATIONS.EMAIL_INTEGRATION_VIEW}><EmailIntegrationPage /></RequirePermission> },
    { path: 'integrations/sms', element: <RequirePermission permission={PERMISSIONS.INTEGRATIONS.SMS_INTEGRATION_VIEW}><SmsIntegrationPage /></RequirePermission> },
    { path: 'integrations/whatsapp', element: <RequirePermission permission={PERMISSIONS.INTEGRATIONS.WHATSAPP_INTEGRATION_VIEW}><WhatsAppIntegrationPage /></RequirePermission> },
    { path: 'settlement-bank', element: <RequirePermission permission={PERMISSIONS.INTEGRATIONS.SETTLEMENT_BANK_VIEW}><SettlementBankAccountPage /></RequirePermission> },
    { path: 'integrations/payment-gateway', element: <Navigate to="/settings/settlement-bank" replace /> },
    { path: 'devices/barcode-scanner', element: <RequirePermission permission={PERMISSIONS.DEVICES.BARCODE_SCANNER_VIEW}><BarcodeScannerSettingsPage /></RequirePermission> },
    { path: 'devices/printer', element: <RequirePermission permission={PERMISSIONS.DEVICES.PRINTERS_VIEW}><PrinterSettingsPage /></RequirePermission> },
    { path: 'devices/cash-drawer', element: <RequirePermission permission={PERMISSIONS.DEVICES.CASH_DRAWER_VIEW}><CashDrawerSettingsPage /></RequirePermission> },
    { path: 'devices/customer-display', element: <RequirePermission permission={PERMISSIONS.DEVICES.CUSTOMER_DISPLAY_VIEW}><CustomerDisplaySettingsPage /></RequirePermission> },
    { path: 'devices/biometric', element: <RequirePermission permission={PERMISSIONS.DEVICES.BIOMETRIC_DEVICE_VIEW}><BiometricDeviceSettingsPage /></RequirePermission> },
    { path: 'login-activity', element: <RequirePermission permission={PERMISSIONS.SETTINGS.LOGIN_ACTIVITY_VIEW}><LoginActivityPage /></RequirePermission> },
  ],
},
];
