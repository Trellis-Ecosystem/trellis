import SkeletonBox from './SkeletonBox'
import ButtonSkeleton from './ButtonSkeleton'

/** Placeholder matching the navbar, with a skeleton wallet button on the right. */
function NavbarSkeleton() {
  return (
    <nav
      role="status"
      aria-label="Loading navigation"
      className="bg-navy-900 dark:bg-navy-900 light:bg-white border-b border-navy-700 dark:border-navy-700 light:border-gray-200 px-6 py-4 flex items-center justify-between"
    >
      <div className="flex items-center gap-6">
        <SkeletonBox width="5rem" height="1.5rem" />
        <div className="hidden sm:flex items-center gap-5">
          <SkeletonBox width="3.5rem" height="1rem" />
          <SkeletonBox width="3.5rem" height="1rem" />
        </div>
      </div>
      <ButtonSkeleton width="9rem" />
    </nav>
  )
}

export default NavbarSkeleton
