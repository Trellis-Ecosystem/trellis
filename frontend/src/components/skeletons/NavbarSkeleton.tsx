import SkeletonBox from './SkeletonBox'

type NavbarSkeletonProps = {
  className?: string
}

function NavbarSkeleton({ className = '' }: NavbarSkeletonProps) {
  return (
    <nav
      aria-hidden="true"
      className={`flex w-full items-center justify-between border-b border-navy-700 bg-[#0A0E17] px-6 py-4 ${className}`.trim()}
    >
      <div className="flex min-w-0 items-center gap-3">
        <SkeletonBox className="h-6 w-24" />
        <SkeletonBox className="hidden h-4 w-44 sm:block" />
      </div>
      <SkeletonBox className="h-9 w-28 rounded-lg sm:w-36" />
    </nav>
  )
}

export default NavbarSkeleton
