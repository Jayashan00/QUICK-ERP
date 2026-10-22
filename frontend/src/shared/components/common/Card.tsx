import type { HTMLAttributes } from "react";

import { cn } from "@/shared/utils/cn";

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6",
        className,
      )}
      {...props}
    />
  );
}
