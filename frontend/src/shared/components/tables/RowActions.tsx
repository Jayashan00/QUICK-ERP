import { MoreHorizontal } from 'lucide-react';
import { Dropdown, type DropdownItem } from '@/shared/components/common/Dropdown';
import { IconButton } from '@/shared/components/common/IconButton';

interface RowActionsProps {
  actions: DropdownItem[];
}

export function RowActions({ actions }: RowActionsProps) {
  if (actions.length === 0) return null;

  return (
    <Dropdown
      align="right"
      trigger={
        <IconButton
          type="button"
          label="Row actions"
          icon={<MoreHorizontal size={16} />}
        />
      }
      items={actions}
    />
  );
}
