import SkeletonBox from './SkeletonBox'

type ButtonSkeletonProps = {
  width?: string | number
  height?: string | number
  className?: string
}

function ButtonSkeleton({ width, height, className = '' }: ButtonSkeletonProps) {
  return (
    <SkeletonBox
      width={width}
      height={height}
      className={`h-11 w-36 rounded-lg ${className}`.trim()}
    />
  )
}

export default ButtonSkeleton
