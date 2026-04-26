import type { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement>

export function Bat({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M14.5 3.5l6 6" />
      <path d="M3 21l4.5-4.5" />
      <rect x="11.5" y="0.5" width="4" height="6.5" rx="1" transform="rotate(-45 13.5 3.75)" />
      <path d="M5.5 14.5l-2.5 2.5a2 2 0 002.83 2.83L8.36 17.3" />
      <path d="M16 6L8 14a3 3 0 000 4.24l.76.76a3 3 0 004.24 0l8-8" />
    </svg>
  )
}

export function Ball({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 12 Q12 10 20.5 12" />
      <path d="M3.5 12 Q12 14 20.5 12" strokeDasharray="2 2" />
    </svg>
  )
}

export function Stumps({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <line x1="6" y1="5" x2="6" y2="22" />
      <line x1="12" y1="5" x2="12" y2="22" />
      <line x1="18" y1="5" x2="18" y2="22" />
      <ellipse cx="9" cy="4" rx="1.2" ry="0.7" />
      <ellipse cx="15" cy="4" rx="1.2" ry="0.7" />
    </svg>
  )
}

export function Gloves({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M5 21V11a3 3 0 016 0v3" />
      <path d="M11 14V8a2 2 0 014 0v6" />
      <path d="M15 14V9a2 2 0 014 0v8a4 4 0 01-4 4H8a4 4 0 01-4-4" />
      <path d="M5 13h14" />
    </svg>
  )
}

export function Crown({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M3 8l3.5 3 5.5-7 5.5 7L21 8l-1.8 9H4.8L3 8z" />
      <circle cx="3" cy="7" r="1.4" />
      <circle cx="21" cy="7" r="1.4" />
      <circle cx="12" cy="3.5" r="1.4" />
    </svg>
  )
}

export function Boundary({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <ellipse cx="12" cy="12" rx="9" ry="9" />
      <ellipse cx="12" cy="12" rx="3" ry="1.2" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </svg>
  )
}
