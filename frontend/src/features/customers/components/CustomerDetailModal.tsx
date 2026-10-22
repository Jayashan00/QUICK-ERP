import { Modal } from '@/shared/components/common/Modal';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { Button } from '@/shared/components/common/Button';
import type { Customer } from '@/features/customers/types/customer';
import { Link } from 'react-router-dom';
import { useTenant } from '@/core/tenant/tenant-context';
import { useBranch } from '@/core/branch/branch-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { TENANT_PERMISSIONS as P } from '@/core/permissions';
import { documentService } from '@/features/documents/documentService';
import { Mail, Phone, MapPin, Building, Calendar, DollarSign, FileText, History } from 'lucide-react';

interface CustomerDetailModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (customer: Customer) => void;
}

export function CustomerDetailModal({
  customer,
  isOpen,
  onClose,
  onEdit,
}: CustomerDetailModalProps) {
  const { tenantId } = useTenant();
  const { branchId, branches } = useBranch();
  const { hasPermission } = usePermissions();
  if (!customer) return null;
  const linkedDocuments = tenantId && branchId && hasPermission(P.DOCUMENTS.VIEW)
    ? documentService.linkedPublic({ tenantId, branchId, permittedBranchIds: branches.map((branch) => branch.id) }, 'Customer', customer.id)
    : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Customer: ${customer.name}`}
      maxWidth="640px"
      footer={
        <div className="flex w-full flex-wrap justify-between gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {onEdit && (
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                onEdit(customer);
              }}
            >
              Edit Customer
            </Button>
          )}
        </div>

      }
    >
      <div className="space-y-5">
        {/* Top Header info */}
        <div className="grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-3">
          <div>
            <span className="text-xs font-medium text-slate-500">
              CODE
            </span>
            <div className="mt-1 font-semibold text-slate-900">{customer.code}</div>
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500">
              TYPE
            </span>
            <div className="mt-1 font-medium capitalize text-slate-900">{customer.type}</div>
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500">
              STATUS
            </span>
            <div className="mt-1">
              <StatusBadge status={customer.status} />
            </div>
          </div>
        </div>

        {(customer.primaryContact || customer.contacts?.length) && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Contacts</h3>
            <div className="space-y-2">
              {(customer.contacts?.length ? customer.contacts : customer.primaryContact ? [{ id: 'primary', ...customer.primaryContact, isPrimary: true }] : []).map((contact) => (
                <div key={contact.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{contact.name || 'Primary contact'}</span>
                    {contact.isPrimary && <span className="text-xs font-medium text-blue-600">Primary</span>}
                  </div>
                  {contact.jobTitle && <div className="mt-1 text-xs text-slate-500">{contact.jobTitle}</div>}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    {contact.email && <span>{contact.email}</span>}
                    {contact.phone && <span>{contact.phone}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {customer.shippingAddress && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Shipping Address</h3>
            <div className="flex items-start gap-2 text-sm text-slate-700">
              <MapPin size={16} className="mt-0.5 shrink-0 text-slate-500" />
              <div>
                <div>{customer.shippingAddress.street}</div>
                <div>{customer.shippingAddress.city}{customer.shippingAddress.state && `, ${customer.shippingAddress.state}`} {customer.shippingAddress.postalCode}</div>
                <div>{customer.shippingAddress.country}</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2">
          <div>
            <div className="text-xs font-medium text-slate-500">Credit Limit</div>
            <div className="mt-1 font-semibold text-slate-900">
              {customer.creditLimit === undefined ? 'Not assigned' : new Intl.NumberFormat('en-US', { style: 'currency', currency: customer.currency }).format(customer.creditLimit)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Payment Terms</div>
            <div className="mt-1 font-semibold text-slate-900">{customer.paymentTermsDays === undefined ? 'Not assigned' : `Net ${customer.paymentTermsDays} days`}</div>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Notes</h3>
          <div className="min-h-16 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{customer.notes || 'No notes have been added.'}</div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FileText size={15} /> Documents</div>
            <div className="mt-2 text-xs text-slate-500">{linkedDocuments.length} document(s) in the shared library.</div>
            {linkedDocuments.map((document) => <div key={document.id} className="mt-1 text-xs text-slate-700">{document.name}</div>)}
            {customer.documents?.length ? <p className="mt-1 text-xs text-slate-500">{customer.documents.length} legacy customer file(s) in customer metadata.</p> : null}
            {hasPermission(P.DOCUMENTS.VIEW) && <Link to="/documents" onClick={onClose} className="mt-2 inline-block text-xs text-blue-700">Open document library</Link>}
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><History size={15} /> Activity & History</div>
            <div className="mt-2 text-xs text-slate-500">Account updated {new Date(customer.updatedAt).toLocaleString()}.</div>
          </div>
        </div>

        {/* Contact Info */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Contact Details
          </h3>
          <div className="grid grid-cols-1 gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-slate-500" />
              <span>{customer.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={16} className="text-slate-500" />
              <span>{customer.phone}</span>
            </div>
            {customer.website && (
              <div className="flex items-center gap-2">
                <Building size={16} className="text-slate-500" />
                <a href={customer.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700">
                  {customer.website}
                </a>
              </div>
            )}
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-slate-500" />
              <span>Currency: {customer.currency}</span>
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Billing Address
          </h3>
          <div className="flex items-start gap-2 text-sm text-slate-700">
            <MapPin size={16} className="mt-0.5 shrink-0 text-slate-500" />
            <div>
              <div>{customer.billingAddress.street}</div>
              <div>
                {customer.billingAddress.city}
                {customer.billingAddress.state && `, ${customer.billingAddress.state}`} {customer.billingAddress.postalCode}
              </div>
              <div>{customer.billingAddress.country}</div>
            </div>
          </div>
        </div>

        {/* Audit timestamps */}
        <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 text-xs text-slate-500 sm:flex-row sm:justify-between">
          <span className="flex items-center gap-1">
            <Calendar size={12} /> Created: {new Date(customer.createdAt).toLocaleDateString()}
          </span>
          <span>Updated: {new Date(customer.updatedAt).toLocaleDateString()}</span>
        </div>
      </div>
    </Modal>
  );
}
