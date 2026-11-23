import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  Edit,
  ExternalLink,
  FileText,
  KeyRound,
  Power,
  Printer,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import {
  platformTenantSchema,
  recordPaymentSchema,
  tenantConfigurationSchema,
} from '@/features/platform/schemas/platformSchemas';
import type {
  PlatformTenantInput,
  RecordPaymentInput,
  TenantConfigurationInput,
} from '@/features/platform/types/platform';
import { platformService } from '@/features/platform/services/platformService';
import { tenantInvoicePdfService } from '@/features/platform/services/tenantInvoicePdfService';
import { usePlatformFoundation, usePlatformMutation } from '@/features/platform/hooks/usePlatformFoundation';
import {
  TENANT_MODULE_CATALOG,
  expandModuleDependencies,
  computeDaysRemaining,
  type TenantModule,
} from '@/core/tenant/tenantEntitlements';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Card } from '@/shared/components/common/Card';
import { Button } from '@/shared/components/common/Button';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { TextInput } from '@/shared/components/forms/TextInput';
import { FormField } from '@/shared/components/forms/FormField';
import { Select } from '@/shared/components/forms/Select';
import { Modal } from '@/shared/components/common/Modal';
import type { IssuedAccessCredentials } from '@/features/platform/services/platformService';
import { appToast } from '@/shared/utils/toast';
import { getErrorMessage } from '@/shared/utils/errors';
import { convertPlatformCurrency } from '@/core/currency/platformCurrency';
import { formatCurrency } from '@/shared/utils/formatters';

const SUBSCRIPTION_PLANS = [
  { value: 'starter', label: 'Starter' },
  { value: 'business', label: 'Business' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'custom', label: 'Custom' },
];

const TENANT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'expired', label: 'Expired' },
];

const ONBOARDING_STAGES = [
  { id: 'company_created', label: 'Company Created', desc: 'Tenant record initialized' },
  { id: 'plan_configured', label: 'Plan Configured', desc: 'Modules, limits & pricing saved' },
  { id: 'invoice_generated', label: 'Invoice Generated', desc: 'Up-to-date PDF invoice created' },
  { id: 'invoice_sent', label: 'Invoice Sent', desc: 'Sent to company owner/admin' },
  { id: 'payment_confirmed', label: 'Payment Confirmed', desc: 'Full payment verified & recorded' },
  { id: 'access_activated', label: 'Access Activated', desc: 'ERP unlocked & invitation issued' },
] as const;

const usageBar = (used: number, limit: number) => `${Math.min(100, Math.round((used / Math.max(limit, 1)) * 100))}%`;

export function TenantDetailPage() {
  const { tenantId = '' } = useParams();
  const navigate = useNavigate();
  const query = usePlatformFoundation();
  const tenant = query.data?.tenants.find((item) => item.id === tenantId);

  const [pendingModules, setPendingModules] = useState<TenantModule[]>([]);
  const [statusConfirm, setStatusConfirm] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [suspendPromptModal, setSuspendPromptModal] = useState(false);
  const [disableConfirm, setDisableConfirm] = useState<TenantModule | null>(null);
  const [editingCompany, setEditingCompany] = useState(false);

  // Onboarding & Payment Modals
  const [previewInvoiceModal, setPreviewInvoiceModal] = useState(false);
  const [recordPaymentModal, setRecordPaymentModal] = useState(false);
  const [issuedCredentials, setIssuedCredentials] = useState<IssuedAccessCredentials | null>(null);
  const [activateConfirmModal, setActivateConfirmModal] = useState(false);

  const form = useForm<TenantConfigurationInput>({
    resolver: zodResolver(tenantConfigurationSchema),
    defaultValues: {
      enabledModules: [],
      maxUsers: 10,
      maxBranches: 2,
      includeAdminInUserLimit: false,
      revenueAmount: 0,
      revenueCurrency: 'USD',
      billingCycle: 'monthly',
      renewalDate: '',
      discountAmount: 0,
      additionalCharges: 0,
      taxRatePercent: 0,
      paymentInstructions: '',
      terms: '',
      subscriptionPlan: 'business',
      subscriptionStart: '',
      subscriptionExpiry: '',
      tenantStatus: 'pending',
    },
  });

  const editForm = useForm<PlatformTenantInput>({
    resolver: zodResolver(platformTenantSchema),
    defaultValues: {
      name: '',
      subdomain: '',
      ownerEmail: '',
      contactName: '',
      country: '',
      adminName: '',
      adminEmail: '',
    },
  });

  const paymentForm = useForm<RecordPaymentInput>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      paidAmount: 0,
      paymentMethod: 'Bank Transfer',
      transactionReference: '',
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: '',
    },
  });

  useEffect(() => {
    if (tenant) {
      setPendingModules(tenant.enabledModules);
      form.reset({
        enabledModules: tenant.enabledModules,
        maxUsers: tenant.limits.maxUsers,
        maxBranches: tenant.limits.maxBranches,
        maxWarehouses: tenant.limits.maxWarehouses,
        maxStorageGb: tenant.limits.maxStorageGb,
        includeAdminInUserLimit: tenant.limits.includeAdminInUserLimit ?? false,
        revenueAmount: tenant.revenue.amount,
        revenueCurrency: tenant.revenue.currency,
        billingCycle: tenant.revenue.billingCycle,
        renewalDate: tenant.revenue.renewalDate,
        discountAmount: tenant.revenue.discountAmount ?? 0,
        additionalCharges: tenant.revenue.additionalCharges ?? 0,
        taxRatePercent: tenant.revenue.taxRatePercent ?? 0,
        paymentInstructions: tenant.revenue.paymentInstructions ?? '',
        terms: tenant.revenue.terms ?? '',
        subscriptionPlan: (tenant.subscription?.plan ?? 'business') as 'starter' | 'business' | 'enterprise' | 'custom',
        subscriptionStart: tenant.subscription?.start ?? '',
        subscriptionExpiry: tenant.subscription?.expiry ?? '',
        tenantStatus: tenant.status,
      });

      const totalDue = tenant.onboarding?.invoice?.totalAmount ?? tenant.revenue.amount ?? 0;
      paymentForm.reset({
        paidAmount: totalDue,
        paymentMethod: 'Bank Transfer',
        transactionReference: '',
        paymentDate: new Date().toISOString().slice(0, 10),
        notes: '',
      });
    }
  }, [form, paymentForm, tenant]);

  const configure = usePlatformMutation((input: TenantConfigurationInput) =>
    platformService.configureTenant(tenantId, input),
  );
  const status = usePlatformMutation(() =>
    platformService.setTenantStatus(tenantId, tenant?.status === 'active' ? 'suspended' : 'active'),
  );
  const resetAdmin = usePlatformMutation(() => platformService.resetTenantAdmin(tenantId));
  const updateCompany = usePlatformMutation((input: PlatformTenantInput) =>
    platformService.updateTenant(tenantId, input),
  );
  const deleteMutation = usePlatformMutation(() =>
    platformService.deleteTenant(tenantId),
  );

  // Workflow mutations
  const generateInvoice = usePlatformMutation(() =>
    platformService.generateInvoice(tenantId, {
      discountAmount: form.getValues('discountAmount'),
      additionalCharges: form.getValues('additionalCharges'),
      taxRatePercent: form.getValues('taxRatePercent'),
      paymentInstructions: form.getValues('paymentInstructions'),
    }),
  );
  const sendInvoiceEmail = usePlatformMutation(() => platformService.sendInvoiceEmail(tenantId));
  const recordPayment = usePlatformMutation((input: RecordPaymentInput) =>
    platformService.recordPayment(tenantId, input),
  );
  const activateAccess = usePlatformMutation(() => platformService.activateTenant(tenantId));

  const grouped = useMemo(
    () =>
      TENANT_MODULE_CATALOG.reduce<Record<string, typeof TENANT_MODULE_CATALOG>>((groups, module) => {
        groups[module.group] = groups[module.group] ?? [];
        groups[module.group]!.push(module);
        return groups;
      }, {}),
    [],
  );

  const baseCurrency = query.data?.settings.baseCurrency ?? 'LKR';
  const convertedRevenue = useMemo(() => {
    if (!tenant) return 0;
    return convertPlatformCurrency(tenant.revenue.amount, tenant.revenue.currency, baseCurrency);
  }, [baseCurrency, tenant]);

  const currentDaysRemaining = useMemo(() => {
    return computeDaysRemaining(tenant?.subscription?.expiry);
  }, [tenant?.subscription?.expiry]);

  // Outdated invoice and stage determination
  const isInvoiceOutdated = Boolean(tenant?.onboarding?.invoice?.isOutdated);
  const isCompanyCreated = Boolean(tenant?.id);
  const isPlanConfigured = Boolean(tenant?.onboarding?.planConfiguredAt || (tenant?.enabledModules && tenant.enabledModules.length > 0));
  const isInvoiceGenerated = Boolean(tenant?.onboarding?.invoice) && !isInvoiceOutdated;
  const isInvoiceSent = Boolean(tenant?.onboarding?.email?.status === 'sent') && !isInvoiceOutdated;
  const isPaymentConfirmed = tenant?.onboarding?.payment?.status === 'paid';
  const isAccessActive = tenant?.status === 'active' && Boolean(tenant?.onboarding?.invitation || tenant?.onboarding?.stage === 'access_activated');

  const stageCompletedMap = useMemo<Record<string, boolean>>(() => ({
    company_created: isCompanyCreated,
    plan_configured: isPlanConfigured,
    invoice_generated: isInvoiceGenerated,
    invoice_sent: isInvoiceSent,
    payment_confirmed: isPaymentConfirmed,
    access_activated: isAccessActive,
  }), [isCompanyCreated, isPlanConfigured, isInvoiceGenerated, isInvoiceSent, isPaymentConfirmed, isAccessActive]);

  // Stage calculation: The active (current) stage is the first incomplete step, or the last if all completed
  const currentStageIndex = useMemo(() => {
    const idx = ONBOARDING_STAGES.findIndex((s) => !stageCompletedMap[s.id]);
    return idx >= 0 ? idx : ONBOARDING_STAGES.length - 1;
  }, [stageCompletedMap]);

  // Unsaved changes detection
  const watchedValues = form.watch();
  const hasUnsavedChanges = useMemo(() => {
    if (!tenant) return false;
    // Check modules
    const savedModules = [...(tenant.enabledModules || [])].sort().join(',');
    const currentModules = [...pendingModules].sort().join(',');
    if (savedModules !== currentModules) return true;

    // Check configuration inputs against persisted tenant
    if (Number(watchedValues.maxUsers) !== (tenant.limits?.maxUsers ?? 10)) return true;
    if (Number(watchedValues.maxBranches) !== (tenant.limits?.maxBranches ?? 2)) return true;
    if ((watchedValues.maxWarehouses ? Number(watchedValues.maxWarehouses) : undefined) !== tenant.limits?.maxWarehouses) return true;
    if ((watchedValues.maxStorageGb ? Number(watchedValues.maxStorageGb) : undefined) !== tenant.limits?.maxStorageGb) return true;
    if (Boolean(watchedValues.includeAdminInUserLimit) !== Boolean(tenant.limits?.includeAdminInUserLimit)) return true;
    if (Number(watchedValues.revenueAmount) !== (tenant.revenue?.amount ?? 0)) return true;
    if (watchedValues.revenueCurrency !== (tenant.revenue?.currency ?? 'USD')) return true;
    if (watchedValues.billingCycle !== (tenant.revenue?.billingCycle ?? 'monthly')) return true;
    if (watchedValues.renewalDate !== (tenant.revenue?.renewalDate ?? '')) return true;
    if (Number(watchedValues.discountAmount ?? 0) !== (tenant.revenue?.discountAmount ?? 0)) return true;
    if (Number(watchedValues.additionalCharges ?? 0) !== (tenant.revenue?.additionalCharges ?? 0)) return true;
    if (Number(watchedValues.taxRatePercent ?? 0) !== (tenant.revenue?.taxRatePercent ?? 0)) return true;
    if ((watchedValues.paymentInstructions ?? '') !== (tenant.revenue?.paymentInstructions ?? '')) return true;
    if ((watchedValues.terms ?? '') !== (tenant.revenue?.terms ?? '')) return true;
    if (watchedValues.subscriptionPlan !== (tenant.subscription?.plan ?? 'business')) return true;
    if (watchedValues.subscriptionStart !== (tenant.subscription?.start ?? '')) return true;
    if (watchedValues.subscriptionExpiry !== (tenant.subscription?.expiry ?? '')) return true;
    if (tenant.status !== 'pending' && watchedValues.tenantStatus !== tenant.status) return true;
    return false;
  }, [tenant, pendingModules, watchedValues]);

  // Discard changes
  const handleDiscardChanges = () => {
    if (!tenant) return;
    setPendingModules(tenant.enabledModules);
    form.reset({
      enabledModules: tenant.enabledModules,
      maxUsers: tenant.limits.maxUsers,
      maxBranches: tenant.limits.maxBranches,
      maxWarehouses: tenant.limits.maxWarehouses,
      maxStorageGb: tenant.limits.maxStorageGb,
      includeAdminInUserLimit: tenant.limits.includeAdminInUserLimit ?? false,
      revenueAmount: tenant.revenue.amount,
      revenueCurrency: tenant.revenue.currency,
      billingCycle: tenant.revenue.billingCycle,
      renewalDate: tenant.revenue.renewalDate,
      discountAmount: tenant.revenue.discountAmount ?? 0,
      additionalCharges: tenant.revenue.additionalCharges ?? 0,
      taxRatePercent: tenant.revenue.taxRatePercent ?? 0,
      paymentInstructions: tenant.revenue.paymentInstructions ?? '',
      terms: tenant.revenue.terms ?? '',
      subscriptionPlan: (tenant.subscription?.plan ?? 'business') as 'starter' | 'business' | 'enterprise' | 'custom',
      subscriptionStart: tenant.subscription?.start ?? '',
      subscriptionExpiry: tenant.subscription?.expiry ?? '',
      tenantStatus: tenant.status,
    });
    appToast.info('Unsaved changes discarded.');
  };

  // Warning when leaving the page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  if (query.isLoading) {
    return (
      <PageContainer>
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner />
        </div>
      </PageContainer>
    );
  }

  if (!tenant) {
    return (
      <PageContainer>
        <ErrorState
          title="Company not found"
          message="This tenant does not exist or is outside your platform access."
          onRetry={() => navigate('/super-admin/tenants')}
        />
      </PageContainer>
    );
  }

  const toggleModule = (module: TenantModule) => {
    if (module === 'settings') return;
    if (pendingModules.includes(module)) {
      setDisableConfirm(module);
      return;
    }
    const next = expandModuleDependencies([...pendingModules, module]);
    setPendingModules(next);
    form.setValue('enabledModules', next, { shouldDirty: true });
  };

  const saveConfiguration = form.handleSubmit(async (values) => {
    try {
      await configure.mutateAsync({ ...values, enabledModules: pendingModules });
      appToast.success('Tenant subscription, modules, limits and pricing updated.');
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Unable to update tenant configuration.');
    }
  });

  const handleGenerateInvoice = async () => {
    if (hasUnsavedChanges) {
      appToast.error('Please save tenant configuration changes first before generating an invoice.');
      return;
    }
    try {
      await generateInvoice.mutateAsync();
      appToast.success('Subscription invoice PDF generated successfully.');
      setPreviewInvoiceModal(true);
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Failed to generate invoice.');
    }
  };

  const handleSendInvoiceEmail = async () => {
    if (isInvoiceOutdated) {
      appToast.error('Current invoice is outdated. Generate an updated invoice before sending.');
      return;
    }
    try {
      await sendInvoiceEmail.mutateAsync();
      appToast.success(`Plan details and invoice sent to ${tenant.admin.email}.`);
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Failed to send invoice email.');
    }
  };

  const handleConfirmPayment = paymentForm.handleSubmit(async (values) => {
    try {
      await recordPayment.mutateAsync(values);
      appToast.success('Customer payment successfully recorded.');
      setRecordPaymentModal(false);
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Unable to record payment.');
    }
  });

  const handleActivateAccess = async () => {
    if (isInvoiceOutdated) {
      appToast.error('Cannot activate tenant while invoice is outdated. Generate an updated invoice and confirm payment.');
      return;
    }
    if (!isPaymentConfirmed) {
      appToast.error('Tenant access cannot be activated until invoice payment is fully confirmed as PAID.');
      return;
    }
    try {
      const activated = await activateAccess.mutateAsync();
      setActivateConfirmModal(false);
      if (activated.accessCredentials) {
        setIssuedCredentials(activated.accessCredentials);
        appToast.success('Company activated. Give the administrator the sign-in details shown.');
      } else {
        appToast.success('Tenant access activated! Secure invitation setup link generated.');
      }
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Failed to activate tenant.');
    }
  };

  return (
    <PageContainer>
      {/* 1. Sticky Action Bar for Unsaved Configuration Changes */}
      {hasUnsavedChanges && (
        <div className="sticky top-2 z-50 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50/95 p-4 shadow-lg backdrop-blur-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <AlertTriangle size={20} />
            </span>
            <div>
              <strong className="text-sm font-semibold text-amber-950">Unsaved Configuration Changes Detected</strong>
              <p className="text-xs text-amber-800">
                You have modified modules, limits, or pricing. Save configurations to persist changes and enable updated invoice generation.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleDiscardChanges}
              disabled={configure.isPending}
            >
              Discard Changes
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void saveConfiguration()}
              isLoading={configure.isPending}
            >
              Save Configurations
            </Button>
          </div>
        </div>
      )}

      <Link
        to="/super-admin/tenants"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-blue-700"
      >
        <ArrowLeft size={15} />
        Back to companies
      </Link>

      <PageHeader
        title={tenant.name}
        description={`${tenant.subdomain}.vyro.cloud · isolated tenant configuration`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              leftIcon={<Edit size={15} />}
              onClick={() => {
                editForm.reset({
                  name: tenant.name,
                  subdomain: tenant.subdomain,
                  ownerEmail: tenant.ownerEmail,
                  contactName: tenant.contactName,
                  country: tenant.country,
                  adminName: tenant.admin.name,
                  adminEmail: tenant.admin.email,
                });
                setEditingCompany(true);
              }}
            >
              Edit Company
            </Button>
            <Button variant="secondary" leftIcon={<KeyRound size={15} />} onClick={() => setResetConfirm(true)}>
              Reset Admin Access
            </Button>
            {tenant.status === 'active' && (
              <Button
                variant="danger"
                leftIcon={<Power size={15} />}
                onClick={() => setStatusConfirm(true)}
              >
                Suspend
              </Button>
            )}
            {tenant.status === 'suspended' && (
              <>
                <Button
                  variant="primary"
                  leftIcon={<Power size={15} />}
                  onClick={() => setStatusConfirm(true)}
                >
                  Reactivate
                </Button>
                <Button
                  variant="danger"
                  leftIcon={<Trash2 size={15} />}
                  onClick={() => setDeleteConfirm(true)}
                >
                  Delete Company
                </Button>
              </>
            )}
            {tenant.status !== 'suspended' && (
              <Button
                variant="secondary"
                leftIcon={<Trash2 size={15} />}
                onClick={() => setSuspendPromptModal(true)}
                title="Company must be suspended before deletion"
              >
                Delete Company
              </Button>
            )}
          </div>
        }
      />

      {/* Controlled Onboarding Progress Stepper Card */}
      <Card className="border-blue-100 bg-gradient-to-r from-blue-50/40 via-white to-slate-50">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                ★
              </span>
              <h2 className="text-base font-semibold text-slate-900">Tenant Onboarding &amp; Activation Workflow</h2>
              <StatusBadge status={tenant.status} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Controlled multi-tenant access cycle: Configuration &rarr; Invoicing &rarr; Payment Confirmation &rarr; Access Activation.
            </p>
          </div>

          {/* Quick Workflow Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {(!isInvoiceGenerated || isInvoiceOutdated) && (
              <Button
                size="sm"
                variant="primary"
                leftIcon={<FileText size={14} />}
                disabled={hasUnsavedChanges}
                isLoading={generateInvoice.isPending}
                onClick={handleGenerateInvoice}
                title={hasUnsavedChanges ? 'Save configuration changes before generating invoice' : undefined}
              >
                {isInvoiceOutdated ? 'Generate Updated Invoice' : 'Generate Invoice PDF'}
              </Button>
            )}

            {isInvoiceGenerated && !isInvoiceOutdated && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Printer size={14} />}
                  onClick={() => tenantInvoicePdfService.previewAndPrint(tenant)}
                >
                  Print / Save PDF
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<ExternalLink size={14} />}
                  onClick={() => setPreviewInvoiceModal(true)}
                >
                  Preview Invoice
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Send size={14} />}
                  isLoading={sendInvoiceEmail.isPending}
                  disabled={isInvoiceOutdated || hasUnsavedChanges}
                  onClick={handleSendInvoiceEmail}
                  title={isInvoiceOutdated ? 'Generate an updated invoice before sending' : undefined}
                >
                  {isInvoiceSent ? 'Resend Invoice Email' : 'Send Plan & Invoice'}
                </Button>
              </>
            )}

            {!isAccessActive && (
              <Button
                size="sm"
                variant={isPaymentConfirmed ? 'secondary' : 'primary'}
                leftIcon={<CreditCard size={14} />}
                onClick={() => setRecordPaymentModal(true)}
              >
                {isPaymentConfirmed ? 'Payment Recorded' : 'Record Payment'}
              </Button>
            )}

            {!isAccessActive && (
              <Button
                size="sm"
                variant="primary"
                disabled={!isPaymentConfirmed || isInvoiceOutdated || hasUnsavedChanges}
                leftIcon={<ShieldCheck size={14} />}
                onClick={() => setActivateConfirmModal(true)}
                title={
                  !isPaymentConfirmed
                    ? 'Confirm customer payment before activating tenant access'
                    : isInvoiceOutdated
                      ? 'Invoice is outdated. Generate and confirm payment for latest invoice before activating.'
                      : hasUnsavedChanges
                        ? 'Save configuration changes before activating access'
                        : undefined
                }
              >
                Activate &amp; Send Access
              </Button>
            )}
          </div>
        </div>

        {/* Outdated Invoice Warning Banner */}
        {isInvoiceOutdated && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <span>
                <strong>Invoice Outdated:</strong> Tenant configuration (pricing, modules, or limits) was modified after the last invoice was generated. Please save any pending changes and click <strong>Generate Updated Invoice</strong> before sending or activating access.
              </span>
            </div>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<FileText size={13} />}
              disabled={hasUnsavedChanges}
              isLoading={generateInvoice.isPending}
              onClick={handleGenerateInvoice}
            >
              Generate Updated Invoice
            </Button>
          </div>
        )}

        {/* Stepper Steps UI */}
        <div className="mt-6 overflow-x-auto pb-2">
          <div className="flex min-w-[760px] items-start justify-between">
            {ONBOARDING_STAGES.map((stage, idx) => {
              const isCompleted = stageCompletedMap[stage.id];
              const isCurrent = idx === currentStageIndex && !isAccessActive;

              return (
                <div key={stage.id} className="relative flex flex-1 flex-col items-center text-center">
                  {/* Connecting line */}
                  {idx < ONBOARDING_STAGES.length - 1 && (
                    <div
                      className={`absolute left-1/2 top-3.5 -z-0 h-0.5 w-full ${
                        isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}
                    />
                  )}

                  {/* Stage Circle */}
                  <div
                    className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      isCompleted
                        ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                        : isCurrent
                          ? 'bg-blue-600 text-white ring-4 ring-blue-100 animate-pulse'
                          : 'border-2 border-slate-300 bg-white text-slate-400'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={15} /> : idx + 1}
                  </div>

                  <span
                    className={`mt-2 text-xs font-semibold ${
                      isCompleted ? 'text-emerald-800' : isCurrent ? 'text-blue-700' : 'text-slate-500'
                    }`}
                  >
                    {stage.label}
                  </span>
                  <span className="mt-0.5 text-[10px] text-slate-400 max-w-[90px]">{stage.desc}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic Context Notice for Current Stage */}
        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-3.5 text-xs text-slate-700 shadow-xs">
          {tenant.status === 'pending' && (
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <strong className="text-amber-900">Tenant Status: PENDING (ERP Access Blocked)</strong>
                <p className="mt-0.5 text-slate-600">
                  This tenant cannot access any ERP modules. Super Admin must complete the onboarding flow: configure subscription &rarr; generate invoice &rarr; send plan details &rarr; confirm payment &rarr; click <strong>Activate &amp; Send Access</strong>.
                </p>
              </div>
            </div>
          )}

          {tenant.status === 'active' && (
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                <div>
                  <strong className="text-emerald-900">Tenant Access Active &amp; Verified</strong>
                  <p className="mt-0.5 text-slate-600">
                    Tenant Admin account is active with Super Admin-bounded module entitlements and resource limits.
                  </p>
                  {tenant.onboarding?.invitation?.setupUrl && (
                    <div className="mt-2 flex items-center gap-2 rounded-md bg-slate-50 p-2 font-mono text-[11px] text-slate-800 border border-slate-200">
                      <span>Setup link: {tenant.onboarding.invitation.setupUrl}</span>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(tenant.onboarding?.invitation?.setupUrl || '');
                          appToast.success('Invitation link copied.');
                        }}
                        className="ml-auto inline-flex items-center gap-1 font-sans text-xs font-semibold text-blue-700 hover:text-blue-800"
                      >
                        <Copy size={13} /> Copy
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Top Overview & Monitoring Grid */}
      <div className="grid gap-5 xl:grid-cols-3">
        {/* Company Info */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Company information</h2>
            <StatusBadge status={tenant.status} />
          </div>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Primary contact</dt>
              <dd className="font-medium text-slate-900">{tenant.contactName} · {tenant.ownerEmail}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Country</dt>
              <dd className="font-medium text-slate-900">{tenant.country}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Created</dt>
              <dd className="font-medium text-slate-900">{new Date(tenant.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Last activity</dt>
              <dd className="font-medium text-slate-900">
                {tenant.lastActivityAt ? new Date(tenant.lastActivityAt).toLocaleString() : 'No activity recorded'}
              </dd>
            </div>
          </dl>
        </Card>

        {/* Subscription & Monitoring Summary */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <ShieldCheck size={18} className="text-blue-600" />
              Subscription &amp; Usage
            </h2>
            <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold capitalize text-blue-800">
              {tenant.subscription?.plan ?? 'business'} Plan
            </span>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subscription Status:</span>
              <StatusBadge status={tenant.status} />
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Expires:</span>
              <span className="font-medium text-slate-900">
                {tenant.subscription?.expiry
                  ? new Date(`${tenant.subscription.expiry}T00:00:00`).toLocaleDateString()
                  : 'Pending Activation'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Days Remaining:</span>
              <span
                className={`font-semibold ${
                  currentDaysRemaining === null
                    ? 'text-slate-500'
                    : currentDaysRemaining < 0
                      ? 'text-red-600'
                      : currentDaysRemaining <= 30
                        ? 'text-orange-600'
                        : 'text-green-700'
                }`}
              >
                {currentDaysRemaining === null
                  ? '—'
                  : currentDaysRemaining < 0
                    ? `Expired (${Math.abs(currentDaysRemaining)}d ago)`
                    : `${currentDaysRemaining} days`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Maximum Users:</span>
              <strong className="text-slate-900">{tenant.limits.maxUsers}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Users &amp; Team Members:</span>
              <strong className="text-slate-900">{tenant.usage.currentUsers}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Remaining Users:</span>
              <strong className={tenant.limits.maxUsers - tenant.usage.currentUsers <= 0 ? 'text-amber-700' : 'text-emerald-700'}>
                {Math.max(0, tenant.limits.maxUsers - tenant.usage.currentUsers)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Branches:</span>
              <strong className="text-slate-900">
                {tenant.usage.currentBranches} / {tenant.limits.maxBranches}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Allowed Modules:</span>
              <span className="font-medium text-blue-700">{tenant.enabledModules.length} enabled</span>
            </div>
          </div>
        </Card>

        {/* Tenant Administrator */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Users size={18} className="text-blue-600" />
              Tenant Administrator
            </h2>
            <StatusBadge status={tenant.admin.status} />
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <span className="text-slate-500">Name:</span>
              <div className="font-medium text-slate-900">{tenant.admin.name}</div>
            </div>
            <div>
              <span className="text-slate-500">Email:</span>
              <div className="font-medium text-slate-900">{tenant.admin.email}</div>
            </div>
            <div>
              <span className="text-slate-500">Invitation Status:</span>
              <div className="font-medium capitalize text-slate-900">
                {tenant.admin.status === 'invited' ? 'Invitation Pending Activation' : tenant.admin.status}
              </div>
            </div>
            {tenant.onboarding?.invoice && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-500">Invoice:</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-slate-800">
                    {tenant.onboarding.invoice.invoiceNumber}
                  </span>
                  <StatusBadge status={tenant.onboarding.invoice.status} />
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Main Configuration Form */}
      <form onSubmit={saveConfiguration} className="space-y-6">
        {/* Card 1: Subscription Plan & Status */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Settings2 size={18} className="text-blue-600" />
              Subscription &amp; Lifecycle Settings
            </h2>
            <span className="text-xs text-slate-500">Super Admin controlled tier</span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <FormField label="Subscription plan" error={form.formState.errors.subscriptionPlan?.message}>
              <Select {...form.register('subscriptionPlan')} options={SUBSCRIPTION_PLANS} />
            </FormField>
            <FormField
              label="Tenant lifecycle status"
              error={form.formState.errors.tenantStatus?.message}
              hint={tenant.status === 'pending' ? 'Pending tenants can only be activated via the "Activate & Send Access" button after payment.' : undefined}
            >
              <Select
                {...form.register('tenantStatus')}
                disabled={tenant.status === 'pending'}
                options={tenant.status === 'pending' ? [{ value: 'pending', label: 'Pending Activation' }] : TENANT_STATUS_OPTIONS}
              />
            </FormField>
            <FormField label="Subscription start date" error={form.formState.errors.subscriptionStart?.message}>
              <TextInput type="date" {...form.register('subscriptionStart')} />
            </FormField>
            <FormField label="Subscription expiry date" error={form.formState.errors.subscriptionExpiry?.message}>
              <TextInput type="date" {...form.register('subscriptionExpiry')} />
            </FormField>
          </div>
        </Card>

        {/* Card 2: Allowed Modules */}
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Allowed ERP modules</h2>
              <p className="text-sm text-slate-500">
                Super Admin strictly controls available modules. Disabled modules and their permissions are hidden from the Tenant Admin.
              </p>
            </div>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
              {pendingModules.length} of {TENANT_MODULE_CATALOG.length} enabled
            </span>
          </div>

          <div className="mt-6 space-y-6">
            {Object.entries(grouped).map(([group, modules]) => (
              <section key={group} className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">{group}</h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {modules.map((module) => {
                    const checked = pendingModules.includes(module.id);
                    return (
                      <label
                        key={module.id}
                        className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                          checked ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={module.id === 'settings'}
                          onChange={() => toggleModule(module.id)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">{module.label}</span>
                          <span className="mt-1 block text-xs text-slate-500">{module.description}</span>
                          {module.dependencies?.length ? (
                            <span className="mt-1 block text-[11px] font-medium text-blue-700">
                              Requires: {module.dependencies.join(', ')}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </Card>

        {/* Card 3: Revenue, Invoicing & Terms */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Subscription pricing, discounts &amp; payment terms</h2>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              leftIcon={<FileText size={14} />}
              onClick={handleGenerateInvoice}
              isLoading={generateInvoice.isPending}
            >
              Update &amp; Re-generate Invoice
            </Button>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Define pricing terms for invoice generation and customer billing.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <FormField label="Base subscription price" error={form.formState.errors.revenueAmount?.message}>
              <TextInput type="number" min={0} step="0.01" {...form.register('revenueAmount', { valueAsNumber: true })} />
            </FormField>
            <FormField label="Currency" error={form.formState.errors.revenueCurrency?.message}>
              <Select
                {...form.register('revenueCurrency')}
                options={[
                  { value: 'USD', label: 'USD ($)' },
                  { value: 'LKR', label: 'LKR (Rs)' },
                ]}
              />
            </FormField>
            <FormField label="Billing cycle" error={form.formState.errors.billingCycle?.message}>
              <Select
                {...form.register('billingCycle')}
                options={[
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'yearly', label: 'Yearly' },
                ]}
              />
            </FormField>
            <FormField label="Renewal date" error={form.formState.errors.renewalDate?.message}>
              <TextInput type="date" {...form.register('renewalDate')} />
            </FormField>

            <FormField label="Discount amount" error={form.formState.errors.discountAmount?.message}>
              <TextInput type="number" min={0} step="0.01" {...form.register('discountAmount', { valueAsNumber: true })} />
            </FormField>
            <FormField label="Additional setup charges" error={form.formState.errors.additionalCharges?.message}>
              <TextInput type="number" min={0} step="0.01" {...form.register('additionalCharges', { valueAsNumber: true })} />
            </FormField>
            <FormField label="Tax rate (%)" error={form.formState.errors.taxRatePercent?.message}>
              <TextInput type="number" min={0} max={100} step="0.1" {...form.register('taxRatePercent', { valueAsNumber: true })} />
            </FormField>
            <FormField label="Subscription terms" error={form.formState.errors.terms?.message}>
              <TextInput placeholder="e.g. 1 Year Enterprise Contract" {...form.register('terms')} />
            </FormField>

            <div className="sm:col-span-2 xl:col-span-4">
              <FormField label="Bank payment instructions (Included on PDF Invoice)" error={form.formState.errors.paymentInstructions?.message}>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Bank: Quick Bank PLC&#10;Account Name: Quick Solutions Ltd&#10;Account Number: 0192837465"
                  {...form.register('paymentInstructions')}
                />
              </FormField>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm">
            <span className="text-slate-500">Platform base currency conversion ({baseCurrency}): </span>
            <strong>{formatCurrency(convertedRevenue, baseCurrency)}</strong>
          </div>
        </Card>

        {/* Card 4: Tenant Limits */}
        <Card>
          <h2 className="font-semibold">Tenant limits</h2>
          <p className="mt-1 text-sm text-slate-500">
            Limits bounded by Super Admin. Tenant Admin can only provision users and branches up to these thresholds.
          </p>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Usage
              label="Users &amp; Team Members"
              used={tenant.usage.currentUsers}
              limit={tenant.limits.maxUsers}
              remaining={Math.max(0, tenant.limits.maxUsers - tenant.usage.currentUsers)}
            />
            <Usage label="Branches" used={tenant.usage.currentBranches} limit={tenant.limits.maxBranches} />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <FormField label="Maximum users" error={form.formState.errors.maxUsers?.message}>
              <TextInput
                type="number"
                min={tenant.usage.currentUsers}
                {...form.register('maxUsers', { valueAsNumber: true })}
              />
            </FormField>
            <FormField label="Maximum branches" error={form.formState.errors.maxBranches?.message}>
              <TextInput
                type="number"
                min={tenant.usage.currentBranches}
                {...form.register('maxBranches', { valueAsNumber: true })}
              />
            </FormField>
            <FormField label="Maximum warehouses (optional)" error={form.formState.errors.maxWarehouses?.message}>
              <TextInput
                type="number"
                min={1}
                {...form.register('maxWarehouses', {
                  setValueAs: (value) => (value === '' ? undefined : Number(value)),
                })}
              />
            </FormField>
            <FormField label="Storage GB (optional)" error={form.formState.errors.maxStorageGb?.message}>
              <TextInput
                type="number"
                min={1}
                {...form.register('maxStorageGb', {
                  setValueAs: (value) => (value === '' ? undefined : Number(value)),
                })}
              />
            </FormField>
            <div className="sm:col-span-2 xl:col-span-4 mt-1">
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 cursor-pointer hover:bg-slate-100/70 transition-colors">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  {...form.register('includeAdminInUserLimit')}
                />
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    Include Tenant Admin in user limit
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    When enabled, the primary Tenant Admin account counts towards the maximum user limit. When disabled, only company users created under Users &amp; Team Members count towards the limit.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </Card>

        {/* Danger Zone */}
        <Card className="mt-6 border-red-200 bg-red-50/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-red-900">Danger Zone</h3>
              <p className="mt-1 text-xs text-red-700">
                {tenant.status === 'suspended'
                  ? 'Permanently delete this company, its user accounts, and all tenant records. This cannot be undone.'
                  : 'A company must be suspended before it can be deleted.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {tenant.status !== 'suspended' ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leftIcon={<Power size={14} />}
                  onClick={() => setStatusConfirm(true)}
                >
                  Suspend Company
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  leftIcon={<Trash2 size={14} />}
                  onClick={() => setDeleteConfirm(true)}
                >
                  Delete Company
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => form.reset()}>
            Discard Changes
          </Button>
          <Button type="submit" leftIcon={<Save size={16} />} isLoading={configure.isPending}>
            Save Configuration
          </Button>
        </div>
      </form>

      {/* Confirmation Dialogs & Modals */}
      <ConfirmDialog
        isOpen={statusConfirm}
        title={tenant.status === 'active' ? 'Suspend Company Access' : 'Activate Company Access'}
        message={
          tenant.status === 'active'
            ? `Suspend "${tenant.name}"? All tenant users will immediately lose access to ERP modules.`
            : `Set "${tenant.name}" to Active? This will grant access according to the current subscription.`
        }
        variant={tenant.status === 'active' ? 'danger' : 'primary'}
        onConfirm={async () => {
          try {
            await status.mutateAsync();
            appToast.success(`Tenant marked ${tenant.status === 'active' ? 'suspended' : 'active'}.`);
            setStatusConfirm(false);
          } catch (error) {
            appToast.error(error instanceof Error ? error.message : 'Unable to change status.');
          }
        }}
        onCancel={() => setStatusConfirm(false)}
      />

      <ConfirmDialog
        isOpen={resetConfirm}
        title="Reset Tenant Admin Invitation"
        message={`Send a fresh access setup invite to ${tenant.admin.email}?`}
        onConfirm={async () => {
          try {
            await resetAdmin.mutateAsync();
            appToast.success('Admin access invitation reset.');
            setResetConfirm(false);
          } catch (error) {
            appToast.error(error instanceof Error ? error.message : 'Unable to reset admin access.');
          }
        }}
        onCancel={() => setResetConfirm(false)}
      />

      <ConfirmDialog
        isOpen={Boolean(disableConfirm)}
        title={`Disable ${disableConfirm} module?`}
        message="Users belonging to this tenant will immediately lose access to this module and its associated permissions."
        variant="danger"
        onConfirm={() => {
          if (!disableConfirm) return;
          const next = pendingModules.filter((module) => module !== disableConfirm);
          setPendingModules(next);
          form.setValue('enabledModules', next, { shouldDirty: true });
          setDisableConfirm(null);
        }}
        onCancel={() => setDisableConfirm(null)}
      />

      {/* Suspend Prompt Before Deletion */}
      <ConfirmDialog
        isOpen={suspendPromptModal}
        title="Company Must Be Suspended"
        message={`"${tenant.name}" is currently ${tenant.status.toUpperCase()}. A company must be suspended before it can be deleted. Would you like to suspend this company now?`}
        confirmLabel="Suspend Company"
        cancelLabel="Cancel"
        variant="warning"
        isLoading={status.isPending}
        onConfirm={async () => {
          try {
            await status.mutateAsync();
            appToast.success(`"${tenant.name}" has been suspended. You can now delete the company.`);
            setSuspendPromptModal(false);
            setDeleteConfirm(true);
          } catch (error) {
            appToast.error(getErrorMessage(error, 'Unable to suspend company.'));
          }
        }}
        onCancel={() => setSuspendPromptModal(false)}
      />

      {/* Confirm Permanent Deletion */}
      <ConfirmDialog
        isOpen={deleteConfirm}
        title={`Delete "${tenant.name}"?`}
        message="Are you sure you want to permanently delete this company? All tenant data, configurations, and user accounts will be permanently removed. This action cannot be undone."
        confirmLabel="Delete Company"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={async () => {
          try {
            await deleteMutation.mutateAsync();
            appToast.success(`Company "${tenant.name}" was permanently deleted.`);
            setDeleteConfirm(false);
            navigate('/super-admin/tenants');
          } catch (error) {
            appToast.error(getErrorMessage(error, 'Unable to delete company.'));
          }
        }}
        onCancel={() => setDeleteConfirm(false)}
      />

      {/* Edit Company Modal */}
      <Modal isOpen={editingCompany} title="Edit company details" onClose={() => setEditingCompany(false)}>
        <form
          className="space-y-4"
          onSubmit={editForm.handleSubmit(async (values) => {
            const trimmedName = values.name.trim().toLowerCase();
            const existingName = (query.data?.tenants ?? []).some(
              (t) => t.id !== tenantId && t.name.trim().toLowerCase() === trimmedName,
            );
            if (existingName) {
              editForm.setError('name', {
                type: 'validate',
                message: 'A company with this name already exists.',
              });
              appToast.error('A company with this name already exists.');
              return;
            }

            const trimmedSubdomain = values.subdomain.trim().toLowerCase();
            const existingSubdomain = (query.data?.tenants ?? []).some(
              (t) => t.id !== tenantId && t.subdomain.trim().toLowerCase() === trimmedSubdomain,
            );
            if (existingSubdomain) {
              editForm.setError('subdomain', {
                type: 'validate',
                message: 'Subdomain is already in use.',
              });
              appToast.error('Subdomain is already in use.');
              return;
            }

            try {
              await updateCompany.mutateAsync(values);
              appToast.success('Company details updated.');
              setEditingCompany(false);
            } catch (error) {
              const message = getErrorMessage(error, 'Unable to update company.');
              if (
                message.toLowerCase().includes('company') ||
                message.toLowerCase().includes('name already exists') ||
                message.toLowerCase().includes('name is already in use')
              ) {
                editForm.setError('name', { type: 'validate', message });
              } else if (message.toLowerCase().includes('subdomain')) {
                editForm.setError('subdomain', { type: 'validate', message });
              }
              appToast.error(message);
            }
          })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {(['name', 'subdomain', 'ownerEmail', 'contactName', 'country', 'adminName', 'adminEmail'] as const).map(
              (field) => (
                <FormField
                  key={field}
                  label={field
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, (string) => string.toUpperCase())}
                  error={editForm.formState.errors[field]?.message}
                >
                  <TextInput {...editForm.register(field)} />
                </FormField>
              ),
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditingCompany(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={updateCompany.isPending}>
              Save Company
            </Button>
          </div>
        </form>
      </Modal>

      {/* Invoice Preview Modal */}
      <Modal
        isOpen={previewInvoiceModal}
        title={`Invoice: ${tenant.onboarding?.invoice?.invoiceNumber || 'Subscription Invoice'}`}
        onClose={() => setPreviewInvoiceModal(false)}
      >
        {tenant.onboarding?.invoice ? (
          <div className="space-y-4 text-sm">
            {tenant.onboarding.invoice.isOutdated && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                <span>
                  <strong>Invoice Outdated:</strong> Tenant configuration has changed since this invoice was generated. Please close and click <strong>Generate Updated Invoice</strong> before sending.
                </span>
              </div>
            )}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <div>
                  <strong className="text-base font-bold text-slate-900">{tenant.name}</strong>
                  <p className="text-xs text-slate-500">{tenant.subdomain}.vyro.cloud</p>
                </div>
                <StatusBadge status={tenant.onboarding.invoice.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Invoice Number:</span>{' '}
                  <strong className="text-slate-900 font-mono">{tenant.onboarding.invoice.invoiceNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Issue Date:</span>{' '}
                  <span className="text-slate-900">{tenant.onboarding.invoice.issueDate}</span>
                </div>
                <div>
                  <span className="text-slate-500">Due Date:</span>{' '}
                  <span className="text-slate-900">{tenant.onboarding.invoice.dueDate}</span>
                </div>
                <div>
                  <span className="text-slate-500">Billing Term:</span>{' '}
                  <span className="capitalize text-slate-900">{tenant.onboarding.invoice.billingCycle}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Base Subscription ({tenant.onboarding.invoice.planName}):</span>
                <span>{tenant.onboarding.invoice.currency} {tenant.onboarding.invoice.basePrice.toFixed(2)}</span>
              </div>
              {tenant.onboarding.invoice.discountAmount > 0 && (
                <div className="flex justify-between text-xs text-emerald-700">
                  <span>Promotional Discount:</span>
                  <span>-{tenant.onboarding.invoice.currency} {tenant.onboarding.invoice.discountAmount.toFixed(2)}</span>
                </div>
              )}
              {tenant.onboarding.invoice.additionalCharges > 0 && (
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Additional Setup Charges:</span>
                  <span>+{tenant.onboarding.invoice.currency} {tenant.onboarding.invoice.additionalCharges.toFixed(2)}</span>
                </div>
              )}
              {tenant.onboarding.invoice.taxAmount > 0 && (
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Taxes ({tenant.onboarding.invoice.taxRatePercent}%):</span>
                  <span>+{tenant.onboarding.invoice.currency} {tenant.onboarding.invoice.taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-base text-blue-900">
                <span>Total Payable:</span>
                <span>{tenant.onboarding.invoice.currency} {tenant.onboarding.invoice.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <div className="font-semibold text-slate-900 mb-1">Payment Instructions</div>
              <p className="whitespace-pre-line text-slate-600">{tenant.onboarding.invoice.paymentInstructions}</p>
            </div>

            <div className="flex justify-between items-center pt-2">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Download size={14} />}
                  onClick={() => tenantInvoicePdfService.downloadInvoiceFile(tenant)}
                >
                  Download File
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Printer size={14} />}
                  onClick={() => tenantInvoicePdfService.previewAndPrint(tenant)}
                >
                  Print PDF
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<Send size={14} />}
                  isLoading={sendInvoiceEmail.isPending}
                  disabled={Boolean(tenant.onboarding.invoice.isOutdated)}
                  onClick={async () => {
                    await handleSendInvoiceEmail();
                    setPreviewInvoiceModal(false);
                  }}
                  title={tenant.onboarding.invoice.isOutdated ? 'Cannot send an outdated invoice' : undefined}
                >
                  Send to {tenant.admin.email}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setPreviewInvoiceModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Invoice not yet generated.</p>
        )}
      </Modal>

      {/* Record Payment Modal */}
      <Modal isOpen={issuedCredentials !== null} title="Company administrator sign-in" onClose={() => setIssuedCredentials(null)}>
        {issuedCredentials && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              The company was created with all default roles. Give these details to its administrator. The password is shown
              <strong> only once</strong>; ask the administrator to change it after the first sign-in (Security page).
            </p>
            <dl className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Sign-in page</dt><dd className="font-mono">{window.location.origin}/login</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Email</dt><dd className="font-mono">{issuedCredentials.email}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Temporary password</dt><dd className="font-mono select-all">{issuedCredentials.temporaryPassword}</dd></div>
            </dl>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => {
                void navigator.clipboard.writeText(`Sign-in: ${window.location.origin}/login\nEmail: ${issuedCredentials.email}\nTemporary password: ${issuedCredentials.temporaryPassword}`);
                appToast.success('Sign-in details copied.');
              }}>Copy details</Button>
              <Button variant="primary" onClick={() => setIssuedCredentials(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={recordPaymentModal} title="Record &amp; Confirm Payment" onClose={() => setRecordPaymentModal(false)}>
        <form className="space-y-4" onSubmit={handleConfirmPayment}>
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
            <strong>Invoice Balance Due:</strong>{' '}
            {tenant.onboarding?.invoice?.currency || tenant.revenue.currency}{' '}
            {(tenant.onboarding?.invoice?.totalAmount ?? tenant.revenue.amount).toFixed(2)}
          </div>

          <FormField label="Amount Paid" error={paymentForm.formState.errors.paidAmount?.message}>
            <TextInput
              type="number"
              step="0.01"
              min={0.01}
              {...paymentForm.register('paidAmount', { valueAsNumber: true })}
            />
          </FormField>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Payment Method" error={paymentForm.formState.errors.paymentMethod?.message}>
              <Select
                {...paymentForm.register('paymentMethod')}
                options={[
                  { value: 'Bank Transfer', label: 'Bank Transfer / Wire' },
                  { value: 'Credit Card', label: 'Credit Card' },
                  { value: 'Cheque', label: 'Company Cheque' },
                  { value: 'Cash', label: 'Cash Payment' },
                  { value: 'Online Gateway', label: 'Online Payment Gateway' },
                ]}
              />
            </FormField>

            <FormField label="Payment Date" error={paymentForm.formState.errors.paymentDate?.message}>
              <TextInput type="date" {...paymentForm.register('paymentDate')} />
            </FormField>
          </div>

          <FormField label="Transaction Reference / Receipt #" error={paymentForm.formState.errors.transactionReference?.message}>
            <TextInput placeholder="e.g. TXN-98471203 or Bank Wire Ref" {...paymentForm.register('transactionReference')} />
          </FormField>

          <FormField label="Audit Notes (Optional)" error={paymentForm.formState.errors.notes?.message}>
            <TextInput placeholder="e.g. Verified by finance team with bank slip" {...paymentForm.register('notes')} />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setRecordPaymentModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={recordPayment.isPending}>
              Confirm Payment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Activate Access Confirmation Dialog */}
      <ConfirmDialog
        isOpen={activateConfirmModal}
        title="Activate Tenant Access &amp; Send Setup Link"
        message={`Activate "${tenant.name}"? This will set company status to ACTIVE, unlock allowed ERP modules, set subscription start/expiry dates, and issue a secure single-use invitation to ${tenant.admin.email}.`}
        variant="primary"
        onConfirm={handleActivateAccess}
        onCancel={() => setActivateConfirmModal(false)}
      />
    </PageContainer>
  );
}

function Usage({ label, used, limit, remaining }: { label: string; used: number; limit: number; remaining?: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <strong>
          {used} / {limit} {remaining !== undefined ? `(${remaining} remaining)` : ''}
        </strong>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600" style={{ width: usageBar(used, limit) }} />
      </div>
    </div>
  );
}
