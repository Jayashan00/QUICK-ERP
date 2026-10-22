import { useNavigate } from 'react-router-dom';
import { Eye, Edit, Trash2, MapPin } from 'lucide-react';
import { DataTable } from '@/shared/components/tables/DataTable';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import type { Column } from '@/shared/components/tables/TableHeader';
import type { DropdownItem } from '@/shared/components/common/Dropdown';
import type { Branch } from '@/core/branch/types/branch';

interface BranchTableProps {
  branches: Branch[];
  isLoading?: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  onDelete: (branch: Branch) => void;
  toolbar?: React.ReactNode;
}

export function BranchTable({
  branches,
  isLoading = false,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  canEdit = true,
  canDelete = true,
  onDelete,
  toolbar,
}: BranchTableProps) {
  const navigate = useNavigate();

  const columns: Column<Branch>[] = [
    {
      key: 'code',
      header: 'Code',
      width: '100px',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
          {row.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Branch Name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="font-medium text-slate-900">{row.name}</div>
          {row.isMain && (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
              HQ / Main
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'city',
      header: 'Location',
      render: (row) => {
        const parts = [row.city, row.state, row.country].filter(Boolean);
        return parts.length > 0 ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <MapPin size={13} className="shrink-0 text-slate-400" />
            <span>{parts.join(', ')}</span>
          </div>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        );
      },
    },
    {
      key: 'managerName',
      header: 'Manager / Contact',
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {row.managerName || '—'}
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Info',
      render: (row) => (
        <div className="text-xs text-slate-600 space-y-0.5">
          {row.email && <div>{row.email}</div>}
          {row.phone && <div className="text-slate-500">{row.phone}</div>}
          {!row.email && !row.phone && <span className="text-slate-400">—</span>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      render: (row) => (
        <StatusBadge status={row.isActive ? 'active' : 'inactive'} />
      ),
    },
  ];

  const getRowActions = (row: Branch): DropdownItem[] => {
    const actions: DropdownItem[] = [
      {
        key: 'view',
        label: 'View Details',
        icon: <Eye size={14} />,
        onClick: () => navigate(`/settings/branches/${row.id}`),
      },
    ];

    if (canEdit) {
      actions.push({
        key: 'edit',
        label: 'Edit Branch',
        icon: <Edit size={14} />,
        onClick: () => navigate(`/settings/branches/${row.id}/edit`),
      });
    }

    if (canDelete && !row.isMain) {
      actions.push({
        key: 'delete',
        label: 'Delete',
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: () => onDelete(row),
      });
    }

    return actions;
  };

  return (
    <DataTable
      columns={columns}
      data={branches}
      keyField="id"
      isLoading={isLoading}
      emptyTitle="No branches found"
      emptyMessage="No company branches match your search criteria or none have been added yet."
      rowActions={getRowActions}
      onRowClick={(row) => navigate(`/settings/branches/${row.id}`)}
      toolbar={toolbar}
      pagination={{
        page,
        pageSize,
        total,
        onPageChange,
        onPageSizeChange,
      }}
    />
  );
}
