import clsx from 'clsx'

/** Logo mark: rising trend line in a gradient tile (matches public/favicon.svg). */
export function BrandMark({ className, size = 32 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={clsx('shrink-0', className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="brand-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#brand-gradient)" />
      <path d="M16 44 L26 32 L34 38 L48 20" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="48" cy="20" r="4.5" fill="#fff" />
    </svg>
  )
}

export default BrandMark
