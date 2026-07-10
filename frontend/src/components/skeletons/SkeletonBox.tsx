type SkeletonSize = string | number

type SkeletonBoxProps = {
  width?: SkeletonSize
  height?: SkeletonSize
  className?: string
}

function SkeletonBox({ width, height, className = '' }: SkeletonBoxProps) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer rounded-md ${className}`.trim()}
      style={{ width, height }}
    />
  )
}

export default SkeletonBox
