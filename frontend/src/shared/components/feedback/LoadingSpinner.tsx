export function LoadingSpinner({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center" role="status" aria-label="Loading">
      <div className="animate-spin rounded-full border-2 border-blue-200 border-r-blue-600" style={{ width: size, height: size }} />
    </div>
  );
}

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10" role="status">
      <div className="size-8 animate-spin rounded-full border-2 border-blue-200 border-r-blue-600" />
      <span className="text-sm text-slate-600">{message}</span>
    </div>
  );
}
