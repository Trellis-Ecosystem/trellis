import type { SVGProps } from 'react'

/**
 * Number One icon — represents "Create Agreement" in the HowItWorks flow.
 * Styled to match other step icons for consistent visual appearance.
 */
export function NumberOneIcon({
  size = 32,
  color = 'currentColor',
  className,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number; color?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <text
        x="12"
        y="18"
        textAnchor="middle"
        fontSize="16"
        fontWeight="bold"
        fill={color}
      >
        1
      </text>
    </svg>
  )
}

export default NumberOneIcon
