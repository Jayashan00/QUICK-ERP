import {
  forwardRef,
  type InputHTMLAttributes,
} from "react";

import { cn } from "@/shared/utils/cn";
import { controlBase, controlError } from "./controlStyles";

export interface TextInputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const TextInput = forwardRef<
  HTMLInputElement,
  TextInputProps
>(function TextInput(
  {
    error,
    className,
    ...props
  },
  ref,
) {
  return (
    <input
      ref={ref}
      type="text"
      aria-invalid={error || undefined}
      className={cn(
        controlBase,
        error && controlError,
        className,
      )}
      {...props}
    />
  );
});
