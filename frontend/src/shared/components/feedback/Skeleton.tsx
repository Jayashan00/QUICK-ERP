export function Skeleton({ width, height = 20 }: { width?: number | string; height?: number | string }) {
  return (
    <div
      className="block animate-pulse rounded-md bg-slate-200"
      style={{ width: width ?? '100%', height, display: 'block' }}
    />
  );
}
