import SkeletonBox from './SkeletonBox'

type AgreementCardSkeletonProps = {
  className?: string
}

function AgreementCardSkeleton({ className = '' }: AgreementCardSkeletonProps) {
  return (
    <section
      aria-hidden="true"
      className={`w-full rounded-2xl border border-slate-700/70 bg-navy-800/80 p-4 shadow-xl shadow-black/10 sm:p-6 ${className}`.trim()}
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="w-full space-y-3 sm:max-w-xl">
          <SkeletonBox className="h-6 w-3/4 sm:w-2/3" />
          <SkeletonBox className="h-4 w-full max-w-md" />
          <SkeletonBox className="h-4 w-11/12 max-w-lg" />
          <SkeletonBox className="h-4 w-10/12 max-w-lg" />
        </div>
        <SkeletonBox className="h-9 w-28 rounded-full" />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-700/60">
        <div className="grid grid-cols-12 gap-3 border-b border-slate-700/60 bg-slate-900/30 px-4 py-3">
          <SkeletonBox className="col-span-5 h-3" />
          <SkeletonBox className="col-span-3 h-3" />
          <SkeletonBox className="col-span-4 h-3" />
        </div>
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="grid grid-cols-12 gap-3 border-b border-slate-700/40 px-4 py-4 last:border-b-0"
          >
            <SkeletonBox className="col-span-12 h-4 sm:col-span-5" />
            <SkeletonBox className="col-span-6 h-4 sm:col-span-3" />
            <SkeletonBox className="col-span-6 h-4 sm:col-span-4" />
          </div>
        ))}
      </div>
    </section>
  )
}

export default AgreementCardSkeleton
