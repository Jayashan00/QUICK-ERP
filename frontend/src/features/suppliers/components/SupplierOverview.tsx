import {
  Building2,
  Calendar,
  CreditCard,
  ExternalLink,
  Globe,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Receipt,
  Smartphone,
  Tag,
  User,
  Wallet,
} from 'lucide-react';

import { Card } from '@/shared/components/common/Card';
import type { Supplier } from '../types/supplier';
import { SupplierStatusBadge } from './SupplierStatusBadge';
import {
  SUPPLIER_CATEGORY_LABELS,
  SUPPLIER_TAX_CATEGORY_LABELS,
  SUPPLIER_PAYMENT_METHOD_LABELS,
  formatMaskedAccountNumber,
} from '../schemas/supplier.schema';


interface SupplierOverviewProps {
  supplier: Supplier;
}

export function SupplierOverview({ supplier }: SupplierOverviewProps) {
  const formattedCreated = supplier.createdAt
    ? new Date(supplier.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  const formattedUpdated = supplier.updatedAt
    ? new Date(supplier.updatedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  const categoryLabel = supplier.category
    ? SUPPLIER_CATEGORY_LABELS[supplier.category] ?? supplier.category
    : 'Uncategorized';

  return (
    <div className="space-y-6">
      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Account Status
          </span>
          <div className="mt-2 flex items-center gap-2">
            <SupplierStatusBadge status={supplier.status} />
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Current vendor standing
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Category / Type
          </span>
          <div className="mt-2 flex items-center gap-2 text-base font-bold text-slate-900 truncate">
            <Tag size={16} className="text-blue-500 shrink-0" />
            <span className="truncate">{categoryLabel}</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Industry classification
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Payment & Terms
          </span>
          <div className="mt-2 flex items-center gap-2 text-base font-bold text-slate-900">
            <CreditCard size={16} className="text-slate-400 shrink-0" />
            <span className="font-mono">{supplier.currency}</span>
            <span className="text-slate-300">•</span>
            <span className="text-sm font-medium text-slate-700">
              {supplier.paymentTermsDays !== undefined && supplier.paymentTermsDays > 0
                ? `Net ${supplier.paymentTermsDays}d`
                : 'Immediate'}
            </span>
          </div>
          <div className="mt-2 truncate text-xs text-slate-500">
            {supplier.paymentMethod
              ? SUPPLIER_PAYMENT_METHOD_LABELS[supplier.paymentMethod] ?? supplier.paymentMethod
              : 'Payment method not set'}
          </div>
        </div>


        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Primary Contact
          </span>
          <div className="mt-2 flex items-center gap-2 text-base font-semibold text-slate-900">
            <User size={16} className="shrink-0 text-slate-400" />
            <span className="truncate">{supplier.contactPerson}</span>
          </div>
          <div className="mt-2 truncate text-xs text-slate-500">
            {supplier.email}
          </div>
        </div>
      </div>

      {/* Main Detail Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Basic Information & Commercial Profile */}
        <Card className="p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Building2 size={16} className="text-slate-500" />
            Basic Supplier Information
          </h3>
          <dl className="divide-y divide-slate-100 text-sm">
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Supplier Name</dt>
              <dd className="font-medium text-slate-900">{supplier.name}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Supplier Code</dt>
              <dd className="font-mono font-semibold text-slate-800">{supplier.code}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Category / Type</dt>
              <dd>
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                  {categoryLabel}
                </span>
              </dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Commercial Currency</dt>
              <dd className="font-mono font-semibold text-slate-900">{supplier.currency}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Payment Terms</dt>
              <dd className="font-medium text-slate-900">
                {supplier.paymentTermsDays !== undefined && supplier.paymentTermsDays > 0
                  ? `Net ${supplier.paymentTermsDays} Days`
                  : 'Immediate / Due on receipt'}
              </dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Account Status</dt>
              <dd>
                <SupplierStatusBadge status={supplier.status} />
              </dd>
            </div>
          </dl>
        </Card>

        {/* Contact Information */}
        <Card className="p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <User size={16} className="text-slate-500" />
            Contact Information
          </h3>
          <dl className="divide-y divide-slate-100 text-sm">
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Contact Person</dt>
              <dd className="font-medium text-slate-900">{supplier.contactPerson}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Email Address</dt>
              <dd className="font-medium text-slate-900">
                <a
                  href={`mailto:${supplier.email}`}
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
                >
                  <Mail size={14} className="text-slate-400" />
                  <span>{supplier.email}</span>
                </a>
              </dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Primary Phone</dt>
              <dd className="font-medium text-slate-900">
                <a
                  href={`tel:${supplier.phone}`}
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
                >
                  <Phone size={14} className="text-slate-400" />
                  <span>{supplier.phone}</span>
                </a>
              </dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Mobile Phone</dt>
              <dd className="font-medium text-slate-900">
                {supplier.mobile ? (
                  <a
                    href={`tel:${supplier.mobile}`}
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
                  >
                    <Smartphone size={14} className="text-slate-400" />
                    <span>{supplier.mobile}</span>
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Website</dt>
              <dd className="font-medium text-slate-900">
                {supplier.website ? (
                  <a
                    href={supplier.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
                  >
                    <Globe size={14} className="text-slate-400" />
                    <span>{supplier.website}</span>
                    <ExternalLink size={12} className="text-slate-400" />
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </dd>
            </div>
          </dl>
        </Card>

        {/* Physical Address Information */}
        <Card className="p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <MapPin size={16} className="text-slate-500" />
            Address Information
          </h3>
          <dl className="divide-y divide-slate-100 text-sm">
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Address Line 1</dt>
              <dd className="font-medium text-slate-900">{supplier.address.street || '—'}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Address Line 2</dt>
              <dd className="font-medium text-slate-900">{supplier.address.street2 || '—'}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">City</dt>
              <dd className="font-medium text-slate-900">{supplier.address.city || '—'}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">State / Province</dt>
              <dd className="font-medium text-slate-900">{supplier.address.state || '—'}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Postal / Zip Code</dt>
              <dd className="font-mono font-medium text-slate-900">{supplier.address.postalCode || '—'}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Country</dt>
              <dd className="font-medium text-slate-900">{supplier.address.country || '—'}</dd>
            </div>
          </dl>
        </Card>

        {/* Tax / VAT Information */}
        <Card className="p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Receipt size={16} className="text-slate-500" />
            Tax / VAT Information
          </h3>
          <dl className="divide-y divide-slate-100 text-sm">
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Tax ID</dt>
              <dd className="font-mono font-semibold text-slate-800">{supplier.taxNumber || '—'}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">VAT Number</dt>
              <dd className="font-mono font-semibold text-slate-800">{supplier.vatNumber || '—'}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Tax Category</dt>
              <dd className="font-medium text-slate-900">
                {supplier.taxCategory
                  ? SUPPLIER_TAX_CATEGORY_LABELS[supplier.taxCategory] ?? supplier.taxCategory
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Registration Number</dt>
              <dd className="font-mono font-semibold text-slate-800">
                {supplier.registrationNumber || '—'}
              </dd>
            </div>
          </dl>
        </Card>

        {/* Payment Settings */}
        <Card className="p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Wallet size={16} className="text-slate-500" />
            Payment Settings
          </h3>
          <dl className="divide-y divide-slate-100 text-sm">
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Payment Terms</dt>
              <dd className="font-medium text-slate-900">
                {supplier.paymentTermsDays !== undefined && supplier.paymentTermsDays > 0
                  ? `Net ${supplier.paymentTermsDays} Days`
                  : 'Immediate / Due on receipt'}
              </dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Preferred Payment Method</dt>
              <dd className="font-medium text-slate-900">
                {supplier.paymentMethod ? (
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                    {SUPPLIER_PAYMENT_METHOD_LABELS[supplier.paymentMethod] ?? supplier.paymentMethod}
                  </span>
                ) : (
                  <span className="text-slate-400">Not configured</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Commercial Currency</dt>
              <dd className="font-mono font-semibold text-slate-900">{supplier.currency}</dd>
            </div>
          </dl>
        </Card>

        {/* Bank / Payment Details */}
        <Card className="p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Landmark size={16} className="text-slate-500" />
            Bank / Payment Details
          </h3>
          {supplier.bankDetails && Object.values(supplier.bankDetails).some(Boolean) ? (
            <dl className="divide-y divide-slate-100 text-sm">
              <div className="flex justify-between py-3">
                <dt className="text-slate-500">Bank Name</dt>
                <dd className="font-medium text-slate-900">{supplier.bankDetails.bankName || '—'}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-slate-500">Account Name / Holder</dt>
                <dd className="font-medium text-slate-900">{supplier.bankDetails.accountName || '—'}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-slate-500">Account Number</dt>
                <dd className="font-mono font-semibold text-slate-900">
                  {formatMaskedAccountNumber(supplier.bankDetails.accountNumber)}
                </dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-slate-500">Branch / Routing</dt>
                <dd className="font-medium text-slate-900">
                  {[supplier.bankDetails.branch, supplier.bankDetails.branchCode]
                    .filter(Boolean)
                    .join(' • ') || '—'}
                </dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-slate-500">SWIFT / BIC</dt>
                <dd className="font-mono font-semibold text-slate-800">
                  {supplier.bankDetails.swiftCode || '—'}
                </dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-slate-500">IBAN</dt>
                <dd className="font-mono font-semibold text-slate-800">
                  {supplier.bankDetails.iban || '—'}
                </dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-slate-500">Account Currency</dt>
                <dd className="font-mono font-semibold text-slate-900">
                  {supplier.bankDetails.currency || supplier.currency}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center">
              <Landmark size={24} className="mx-auto text-slate-400" />
              <p className="mt-2 text-xs font-semibold text-slate-700">No Bank Account Configured</p>
              <p className="mt-1 text-xs text-slate-500">
                Banking details have not been provided for this vendor yet.
              </p>
            </div>
          )}
        </Card>
      </div>


      {/* Additional Information & Audit Card */}
      <Card className="p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Calendar size={16} className="text-slate-500" />
          Additional Information & Audit
        </h3>
        <div className="space-y-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Internal Notes</span>
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3.5 text-sm text-slate-700">
              {supplier.notes ? supplier.notes : 'No internal notes provided for this vendor.'}
            </p>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-3 text-sm">
            <div className="flex justify-between py-1">
              <dt className="text-slate-500">Created On</dt>
              <dd className="text-slate-700">{formattedCreated}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-slate-500">Last Updated</dt>
              <dd className="text-slate-700">{formattedUpdated}</dd>
            </div>
          </dl>
        </div>
      </Card>
    </div>
  );
}
