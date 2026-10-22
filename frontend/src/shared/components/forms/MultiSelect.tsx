import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { SelectOption } from './Select';
import { cn } from '@/shared/utils/cn';
import { controlBase, controlError, choiceControl } from './controlStyles';

export interface MultiSelectProps {
  options: SelectOption[];
  value: (string | number)[];
  onChange: (value: (string | number)[]) => void;
  placeholder?: string;
  error?: boolean;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  ariaDescribedBy?: string;
}

export function MultiSelect({
  options,
  value = [],
  onChange,
  placeholder = 'Select options...',
  error,
  id,
  name,
  disabled,
  required,
  className,
  ariaDescribedBy,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const toggleOption = (val: string | number) => {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  const removeValue = (val: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== val));
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      {name && value.map((selectedValue) => (
        <input key={selectedValue} type="hidden" name={name} value={selectedValue} />
      ))}
      <div
        id={id}
        className={cn(controlBase, 'flex h-auto min-h-10 flex-wrap items-center gap-1 py-1 pr-9', disabled ? 'cursor-not-allowed' : 'cursor-pointer', error && controlError)}
        onClick={() => !disabled && setOpen(!open)}
        onKeyDown={(event) => {
          if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            setOpen(!open);
          }
        }}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={error || undefined}
        aria-describedby={ariaDescribedBy}
        aria-required={required || undefined}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
      >
        {value.length === 0 ? (
          <span className="text-sm text-slate-400">
            {placeholder}
          </span>
        ) : (
          value.map((val) => {
            const opt = options.find((o) => o.value === val);
            return (
              <span
                key={val}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
              >
                <span>{opt?.label ?? val}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={(e) => removeValue(val, e)}
                  className="rounded text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label={`Remove ${opt?.label ?? val}`}
                >
                  <X size={12} />
                </button>
              </span>
            );
          })
        )}
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 text-slate-500"
        />
      </div>

      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+4px)] z-50 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg" role="listbox">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
            >
              <input
                type="checkbox"
                className={choiceControl}
                checked={value.includes(opt.value)}
                disabled={opt.disabled}
                onChange={() => toggleOption(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
