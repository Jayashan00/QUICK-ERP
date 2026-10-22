import { useSearchRecord } from '@/features/global-search/hooks/useSearchRecord';
import { customerService } from '../services/customerService';
import { useState } from 'react';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { StatCard } from '@/shared/components/cards/StatCard';
import { DataTable } from '@/shared/components/tables/DataTable';
import { TableToolbar } from '@/shared/components/tables/TableToolbar';
import { FilterPanel } from '@/shared/components/tables/FilterPanel';
import { Button } from '@/shared/components/common/Button';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Card } from '@/shared/components/common/Card';
import { useCustomers } from '../hooks/useCustomers';
import { CustomerDetailModal } from '../components/CustomerDetailModal';
import { CustomerFormModal } from '../components/CustomerFormModal';
import type { CustomerFormValues } from '../schemas/customerSchema';
import type { Customer } from '@/features/customers/types/customer';
import type { Column } from '@/shared/components/tables/TableHeader';
import { Users, UserCheck, UserPlus, UserX, Plus, Download } from 'lucide-react';
import { controlBase } from '@/shared/components/forms/controlStyles';
import { cn } from '@/shared/utils/cn';
import { getErrorMessage } from '@/shared/utils/errors';
import { appToast } from '@/shared/utils/toast';
import { Can } from '@/core/permissions/components';
import { PERMISSIONS } from '@/core/permissions';
import { usePermissions } from '@/core/permissions/permission-context';
import type { DropdownItem } from '@/shared/components/common/Dropdown';

export function CustomersPage() {
  const searchRecord = useSearchRecord('customers', 'customers.view', customerService.getCustomerById);
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission(PERMISSIONS.CUSTOMERS.CREATE);
  const canEdit = hasPermission(PERMISSIONS.CUSTOMERS.EDIT);
  const canDelete = hasPermission(PERMISSIONS.CUSTOMERS.DELETE);
  const canExport = hasPermission(PERMISSIONS.CUSTOMERS.EXPORT);
  const {
    customers,
    total,
    isLoading,
    error,
    refetch,
    search,
    setSearch,
    status,
    setStatus,
    type,
    setType,
    page,
    setPage,
    pageSize,
    setPageSize,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    isDeleting,
  } = useCustomers({ search: searchRecord.initialSearch });

  // Modals state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Stats calculation
  const activeCount = customers.filter((c) => c.status === 'active').length;
  const leadCount = customers.filter((c) => c.status === 'lead').length;

  const columns: Column<Customer>[] = [
    {
      key: 'code',
      header: 'Code',
      width: '120px',
      render: (row) => <span className="font-semibold text-slate-900">{row.code}</span>,
    },
    {
      key: 'name',
      header: 'Customer Name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-semibold text-blue-600">{row.name}</div>
          <div className="text-xs text-slate-500">
            {row.email}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      width: '120px',
      render: (row) => (
        <span className="text-xs capitalize text-slate-600">
          {row.type}
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => <span>{row.phone}</span>,
    },
    {
      key: 'city',
      header: 'Location',
      render: (row) => (
        <span>
          {row.billingAddress.city}, {row.billingAddress.country}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  const handleCreateOrUpdate = async (
    data: CustomerFormValues
  ) => {
    const { shippingSameAsBilling, shippingAddress, primaryContact, ...customerData } = data;
    const hasPrimaryContact = Boolean(
      primaryContact.name || primaryContact.email || primaryContact.phone || primaryContact.jobTitle,
    );
    const normalizedData = {
      ...customerData,
      shippingAddress: shippingSameAsBilling ? undefined : shippingAddress,
      primaryContact: hasPrimaryContact ? primaryContact : undefined,
      contacts: hasPrimaryContact
        ? [{
            id: editingCustomer?.contacts?.[0]?.id ?? crypto.randomUUID(),
            ...primaryContact,
            isPrimary: true,
          }]
        : [],
    };
    if (editingCustomer) {
      await updateCustomer(editingCustomer.id, normalizedData);
    } else {
      await createCustomer(normalizedData);
    }
  };

  const handleConfirmDelete = async () => {
    if (deletingId) {
      try {
        await deleteCustomer(deletingId);
        setDeletingId(null);
        appToast.success('Customer deleted successfully.');
      } catch (error) {
        appToast.error(getErrorMessage(error, 'Unable to delete the customer. Please try again.'));
      }
    }
  };

  const handleExport = () => {
    const escapeCell = (value: string | number | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = customers.map((customer) => [
      customer.code,
      customer.name,
      customer.type,
      customer.email,
      customer.phone,
      customer.status,
      customer.billingAddress.city,
      customer.billingAddress.country,
      customer.creditLimit,
      customer.paymentTermsDays,
    ]);
    const csv = [
      ['Code', 'Name', 'Type', 'Email', 'Phone', 'Status', 'City', 'Country', 'Credit Limit', 'Payment Terms Days'],
      ...rows,
    ].map((row) => row.map(escapeCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    appToast.success(`Exported ${customers.length} customer record(s).`);
  };

  return (
    <PageContainer>{searchRecord.recordId && searchRecord.unavailable && <ErrorState message="Requested customer is unavailable in this branch." />}
      <PageHeader
        title="Customers"
        description="Manage client relationships, contact profiles, credit limits, and billing details."
        actions={(canExport || canCreate) ? (
          <>
            <Can permission={PERMISSIONS.CUSTOMERS.EXPORT}>
              <Button
                variant="secondary"
                leftIcon={<Download size={16} />}
                onClick={handleExport}
              >
                Export
              </Button>
            </Can>
            <Can permission={PERMISSIONS.CUSTOMERS.CREATE}>
              <Button
                variant="primary"
                leftIcon={<Plus size={16} />}
                onClick={() => {
                  setEditingCustomer(null);
                  setIsFormOpen(true);
                }}
              >
                Add Customer
              </Button>
            </Can>
          </>
        ) : undefined}
      />

      {/* KPI Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Clients"
          value={total}
          icon={<Users size={20} />}
          change={{ value: '+12%', trend: 'up', label: 'vs last month' }}
        />
        <StatCard
          title="Active Accounts"
          value={activeCount}
          icon={<UserCheck size={20} />}
          change={{ value: '+4', trend: 'up', label: 'new this week' }}
        />
        <StatCard
          title="Leads / Prospects"
          value={leadCount}
          icon={<UserPlus size={20} />}
          description="Awaiting first quotation"
        />
        <StatCard
          title="Inactive"
          value={total - activeCount - leadCount}
          icon={<UserX size={20} />}
          description="Dormant over 90 days"
        />
      </div>

      {/* Data Table with Search and Filters */}
      {error ? (
        <Card className="p-0">
          <ErrorState message={error} onRetry={() => void refetch()} />
        </Card>
      ) : (
      <DataTable<Customer>
        columns={columns}
        data={customers}
        keyField="id"
        isLoading={isLoading}
        emptyTitle="No customers found"
        emptyMessage="Try adjusting your search query or filter settings."
        emptyAction={canCreate ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingCustomer(null);
              setIsFormOpen(true);
            }}
          >
            Add First Customer
          </Button>
        ) : undefined}
        onRowClick={(customer) => {
          setSelectedCustomer(customer);
          setIsDetailOpen(true);
        }}
        rowActions={(customer) => {
          const actions: DropdownItem[] = [{
            key: 'view',
            label: 'View Details',
            onClick: () => {
              setSelectedCustomer(customer);
              setIsDetailOpen(true);
            },
          }];

          if (canEdit) actions.push({
            key: 'edit',
            label: 'Edit Customer',
            onClick: () => {
              setEditingCustomer(customer);
              setIsFormOpen(true);
            },
          });

          if (canDelete) actions.push({
            key: 'delete',
            label: 'Delete Customer',
            danger: true,
            onClick: () => setDeletingId(customer.id),
          });

          return actions;
        }}
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
        toolbar={
          <TableToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by name, email, code..."
            filters={
              <FilterPanel
                activeFilterCount={(status !== 'all' ? 1 : 0) + (type !== 'all' ? 1 : 0)}
                onReset={() => {
                  setStatus('all');
                  setType('all');
                  setSearch('');
                }}
              >
                <select
                  className={cn(controlBase, 'h-8 w-full py-0 text-xs sm:w-auto')}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="lead">Lead</option>
                  <option value="inactive">Inactive</option>
                </select>
                <select
                  className={cn(controlBase, 'h-8 w-full py-0 text-xs sm:w-auto')}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="company">Company</option>
                  <option value="individual">Individual</option>
                </select>
              </FilterPanel>
            }
          />
        }
      />

      )}

      {/* Customer Detail View Modal */}
      <CustomerDetailModal
        customer={searchRecord.recordId ? searchRecord.record : selectedCustomer}
        isOpen={searchRecord.recordId ? Boolean(searchRecord.record) : isDetailOpen}
        onClose={() => { setIsDetailOpen(false); searchRecord.clearRecord(); }}
        onEdit={canEdit ? (cust) => {
          setEditingCustomer(cust);
          setIsFormOpen(true);
        } : undefined}
      />

      {/* Customer Form Modal (Create / Edit) */}
      {(canCreate || canEdit) && <CustomerFormModal
        customer={editingCustomer}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingCustomer(null);
        }}
        onSubmit={handleCreateOrUpdate}
      />}

      {/* Delete Confirmation Dialog */}
      {canDelete && <ConfirmDialog
        isOpen={!!deletingId}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? All associated history in mock storage will be removed. This action cannot be undone."
        variant="danger"
        confirmLabel="Delete"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingId(null)}
      />}
    </PageContainer>
  );
}
