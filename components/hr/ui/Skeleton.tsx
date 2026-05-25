function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer ${className}`} />
}

export function SkeletonKpiGrid({ count = 5, cols = 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5' }: { count?: number; cols?: string }) {
  return (
    <div className={`grid ${cols} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="relative card p-5 space-y-3 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[3px] skeleton-shimmer" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-2.5 w-28" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6 p-6">
      <SkeletonKpiGrid count={4} cols="grid-cols-2 md:grid-cols-4" />
      <SkeletonKpiGrid count={5} cols="grid-cols-2 md:grid-cols-4 lg:grid-cols-5" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-3 w-full" />)}
        </div>
        <div className="card p-5 lg:col-span-2 space-y-4">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Skeleton
