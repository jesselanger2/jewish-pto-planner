/**
 * src/components/LoadingSpinner.tsx
 * Accessible spinner with aria-label.
 */
interface SpinnerProps {
  label?: string
  size?: number
}

export function LoadingSpinner({ label = 'Loading…', size = 24 }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <svg
        className="animate-spin"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="12" cy="12" r="10"
          stroke="var(--navy-700)"
          strokeWidth="3"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="var(--indigo-500)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}
