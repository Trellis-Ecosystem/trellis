import SkeletonBox from './SkeletonBox'

const MILESTONE_ROWS = [0, 1, 2]

/** Placeholder matching the shape of a loaded Agreement card. */
function AgreementCardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading agreement"
      className="rounded-xl border border-navy-700 dark:border-navy-700 light:border-gray-200 bg-navy-800/60 dark:bg-navy-800/60 light:bg-gray-50 p-6"
    >
      {/* Agreement ID */}
      <SkeletonBox width="70%" height="1.5rem" />

      {/* Payer / payee / resolver addresses */}
      <div className="mt-6 space-y-3">
        <SkeletonBox width="45%" height="1rem" />
        <SkeletonBox width="45%" height="1rem" />
        <SkeletonBox width="45%" height="1rem" />
      </div>

      {/* Milestone table */}
      <div className="mt-8 space-y-3">
        <div className="flex gap-4">
          <SkeletonBox width="40%" height="0.875rem" />
          <SkeletonBox width="25%" height="0.875rem" />
          <SkeletonBox width="20%" height="0.875rem" />
        </div>
        {MILESTONE_ROWS.map((row) => (
          <div key={row} className="flex gap-4">
            <SkeletonBox width="40%" height="1.25rem" />
            <SkeletonBox width="25%" height="1.25rem" />
            <SkeletonBox width="20%" height="1.25rem" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default AgreementCardSkeleton
