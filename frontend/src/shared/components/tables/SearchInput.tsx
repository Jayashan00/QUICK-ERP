import { Search, X } from 'lucide-react';
import { type ChangeEvent } from 'react';
import { IconButton } from '@/shared/components/common/IconButton';
import { controlBase } from '@/shared/components/forms/controlStyles';
import { cn } from '@/shared/utils/cn';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  onClear,
}: SearchInputProps) {
  return (
    <div className="relative flex w-full items-center sm:max-w-xs">
      <Search
        size={16}
        className="pointer-events-none absolute left-3 text-slate-400"
      />
      <input
        type="text"
        className={cn(controlBase, 'pl-9', value && 'pr-10')}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <IconButton
          type="button"
          onClick={() => {
            onChange('');
            onClear?.();
          }}
          className="absolute right-0.5 size-8"
          label="Clear search"
          icon={<X size={14} />}
        />
      )}
    </div>
  );
}
