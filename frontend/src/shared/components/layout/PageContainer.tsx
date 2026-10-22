import type {
  ReactNode,
} from "react";

import { cn } from "@/shared/utils/cn";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({
  children,
  className,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1600px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
