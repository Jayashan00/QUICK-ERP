import type {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

import { cn } from "@/shared/utils/cn";

interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
}

export function IconButton({
  icon,
  label,
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-lg text-slate-500 transition-colors sm:size-9",
        "hover:bg-slate-100 hover:text-slate-900",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
