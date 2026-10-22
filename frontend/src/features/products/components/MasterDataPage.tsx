import { useState, type ReactNode } from 'react';
import { Edit, Eye, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import type { DropdownItem } from '@/shared/components/common/Dropdown';
import { Modal } from '@/shared/components/common/Modal';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Select } from '@/shared/components/forms/Select';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { DataTable } from '@/shared/components/tables/DataTable';
import { TableToolbar } from '@/shared/components/tables/TableToolbar';
import type { Column } from '@/shared/components/tables/TableHeader';
import { appToast } from '@/shared/utils/toast';
import type { MasterDataListParams } from '../types/masterData';

interface MasterRecord {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface MasterDataState<T extends MasterRecord> {
  records: T[];
  total: number;
  search: string;
  status: NonNullable<MasterDataListParams['status']>;
  page: number;
  pageSize: number;
  isLoading: boolean;
  isDeleting: boolean;
  error: string | null;
  setSearch: (value: string) => void;
  setStatus: (value: NonNullable<MasterDataListParams['status']>) => void;
  setPage: (value: number) => void;
  setPageSize: (value: number) => void;
  refetch: () => unknown;
  remove: (id: string) => Promise<void>;
}

interface MasterDataPageProps<T extends MasterRecord> {
  title: string;
  description: string;
  singular: string;
  columns: Column<T>[];
  data: MasterDataState<T>;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  renderForm: (item: T | null, close: () => void) => ReactNode;
  renderDetails: (item: T) => ReactNode;
}

export function MasterDataPage<T extends MasterRecord>({
  title,
  description,
  singular,
  columns,
  data,
  canCreate,
  canEdit,
  canDelete,
  renderForm,
  renderDetails,
}: MasterDataPageProps<T>) {
  const [editing, setEditing] = useState<T | null | undefined>();
  const [viewing, setViewing] = useState<T | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);
  const closeForm = () => setEditing(undefined);

  const actions = (item: T): DropdownItem[] => {
    const result: DropdownItem[] = [{ key: 'view', label: 'View Details', icon: <Eye size={14} />, onClick: () => setViewing(item) }];
    if (canEdit) result.push({ key: 'edit', label: `Edit ${singular}`, icon: <Edit size={14} />, onClick: () => setEditing(item) });
    if (canDelete) result.push({ key: 'delete', label: `Delete ${singular}`, icon: <Trash2 size={14} />, danger: true, onClick: () => setDeleting(item) });
    return result;
  };

  return (
    <PageContainer>
      <PageHeader
        title={title}
        description={description}
        actions={canCreate ? <Button leftIcon={<Plus size={16} />} onClick={() => setEditing(null)}>Add {singular}</Button> : undefined}
      />
      {data.error ? (
        <Card className="p-0"><ErrorState message={data.error} onRetry={() => void data.refetch()} /></Card>
      ) : (
        <DataTable
          columns={columns}
          data={data.records}
          keyField="id"
          isLoading={data.isLoading}
          onRowClick={setViewing}
          rowActions={actions}
          emptyTitle={`No ${title.toLocaleLowerCase()} found`}
          emptyMessage={`Add a ${singular.toLocaleLowerCase()} or adjust the filters.`}
          pagination={{ page: data.page, pageSize: data.pageSize, total: data.total, onPageChange: data.setPage, onPageSizeChange: data.setPageSize }}
          toolbar={
            <TableToolbar
              searchValue={data.search}
              onSearchChange={data.setSearch}
              searchPlaceholder={`Search ${title.toLocaleLowerCase()}...`}
              filters={
                <Select
                  className="w-36 py-1 text-xs"
                  value={data.status}
                  onChange={(event) => data.setStatus(event.target.value as MasterDataState<T>['status'])}
                  options={[{ value: 'all', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
                />
              }
            />
          }
        />
      )}

      {editing !== undefined && renderForm(editing, closeForm)}
      <Modal
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={`${singular} Details`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setViewing(null)}>Close</Button>
            {canEdit && viewing && <Button leftIcon={<Edit size={15} />} onClick={() => { setEditing(viewing); setViewing(null); }}>Edit {singular}</Button>}
          </>
        }
      >
        {viewing && <><div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{viewing.name}</h3><p className="mt-1 font-mono text-xs text-slate-500">{viewing.code}</p></div><StatusBadge status={viewing.isActive ? 'active' : 'inactive'} /></div>{renderDetails(viewing)}</>}
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title={`Delete ${singular}`}
        message={`Delete "${deleting?.name ?? `this ${singular.toLocaleLowerCase()}`}"? Records used by products cannot be deleted.`}
        confirmLabel={`Delete ${singular}`}
        variant="danger"
        isLoading={data.isDeleting}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          void data.remove(deleting.id).then(() => { appToast.success(`${singular} deleted.`); setDeleting(null); }).catch((error: unknown) => appToast.error(error instanceof Error ? error.message : `Unable to delete ${singular.toLocaleLowerCase()}.`));
        }}
      />
    </PageContainer>
  );
}
