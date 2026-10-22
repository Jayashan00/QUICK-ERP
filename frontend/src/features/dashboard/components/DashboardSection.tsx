import type { ReactNode } from 'react';

export function DashboardSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="space-y-4"><div><h2 className="text-base font-semibold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>{children}</section>;
}
