import SkeletonBox from './SkeletonBox'

type EventFeedSkeletonProps = {
  className?: string
}

function EventFeedSkeleton({ className = '' }: EventFeedSkeletonProps) {
  return (
    <section aria-hidden="true" className={`w-full space-y-4 ${className}`.trim()}>
      {[0, 1, 2, 3, 4].map((eventIndex) => (
        <div key={eventIndex} className="flex gap-4 rounded-xl border border-slate-700/60 bg-navy-800/70 p-4">
          <div className="flex flex-col items-center">
            <SkeletonBox className="h-4 w-4 rounded-full" />
            {eventIndex < 4 && <SkeletonBox className="mt-2 h-12 w-0.5 rounded-full" />}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <SkeletonBox className="h-4 w-2/3 max-w-xs" />
              <SkeletonBox className="h-3 w-20" />
            </div>
            <SkeletonBox className="h-3 w-full max-w-lg" />
            <SkeletonBox className="h-3 w-5/6 max-w-md" />
          </div>
        </div>
      ))}
    </section>
  )
}

export default EventFeedSkeleton
