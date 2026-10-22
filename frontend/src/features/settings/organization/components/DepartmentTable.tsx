import { useNavigate } from 'react-router-dom';
import { Eye, Edit, Trash2 } from 'lucide-react';
import { DataTable } from '@/shared/components/tables/DataTable';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import type { Column } from '@/shared/components/tables/TableHeader';
import type { DropdownItem } from '@/shared/components/common/Dropdown';
import type { Department } from '@/features/settings/organization/types/department';

interface DepartmentTableProps {
  departments: Department[];
  isLoading?: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  onDelete: (dept: Department) => void;
  toolbar?: React.ReactNode;
}

export function DepartmentTable({
  departments,
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
}: DepartmentTableProps) {
  const navigate = useNavigate();

  const columns: Column<Department>[] = [
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
      header: 'Department Name',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-900">{row.name}</div>
          {row.description && (
            <div className="text-xs text-slate-500 line-clamp-1 max-w-sm">
              {row.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'managerName',
      header: 'Department Head',
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {row.managerName || '—'}
        </span>
      ),
    },
    {
      key: 'branchName',
      header: 'Assigned Branch',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {row.branchName || 'All Branches'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      render: (row) => (
        <StatusBadge status={row.status === 'active' ? 'active' : 'inactive'} />
      ),
    },
  ];

  const getRowActions = (row: Department): DropdownItem[] => {
    const actions: DropdownItem[] = [
      {
        key: 'view',
        label: 'View Details',
        icon: <Eye size={14} />,
        onClick: () => navigate(`/settings/departments/${row.id}`),
      },
    ];

    if (canEdit) {
      actions.push({
        key: 'edit',
        label: 'Edit Department',
        icon: <Edit size={14} />,
        onClick: () => navigate(`/settings/departments/${row.id}/edit`),
      });
    }

    if (canDelete) {
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
      data={departments}
      keyField="id"
      isLoading={isLoading}
      emptyTitle="No departments found"
      emptyMessage="No departments match your search criteria or none have been configured yet."
      rowActions={getRowActions}
      onRowClick={(row) => navigate(`/settings/departments/${row.id}`)}
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
