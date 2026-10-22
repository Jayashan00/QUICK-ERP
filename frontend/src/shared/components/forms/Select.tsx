import {
  forwardRef,
  type SelectHTMLAttributes,
} from "react";

import { cn } from "@/shared/utils/cn";
import { controlBase, controlError } from "./controlStyles";

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  placeholder?: string;
  error?: boolean;
}

export const Select = forwardRef<
  HTMLSelectElement,
  SelectProps
>(function Select(
  {
    options,
    placeholder,
    error,
    className,
    ...props
  },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={error || undefined}
      className={cn(
        controlBase,
        "pr-9",
        error && controlError,
        className,
      )}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}

      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
});
