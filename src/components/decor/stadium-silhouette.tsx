import type { SVGProps } from "react"

export function StadiumSilhouette({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1200 200"
      fill="currentColor"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M0 200 L0 140 L60 132 L120 122 L180 116 L240 110 L300 104 L360 98 L420 94 L480 90 L540 88 L600 86 L660 88 L720 90 L780 94 L840 98 L900 104 L960 110 L1020 116 L1080 122 L1140 132 L1200 140 L1200 200 Z" />
      <path d="M0 200 L0 168 L80 162 L160 156 L240 150 L320 146 L400 142 L480 140 L560 138 L600 138 L640 138 L720 140 L800 142 L880 146 L960 150 L1040 156 L1120 162 L1200 168 L1200 200 Z" opacity="0.6" />
      <line x1="120" y1="60" x2="120" y2="120" stroke="currentColor" strokeWidth="2" />
      <rect x="113" y="48" width="14" height="14" rx="1" />
      <line x1="350" y1="50" x2="350" y2="116" stroke="currentColor" strokeWidth="2" />
      <rect x="343" y="38" width="14" height="14" rx="1" />
      <line x1="600" y1="40" x2="600" y2="110" stroke="currentColor" strokeWidth="2" />
      <rect x="593" y="28" width="14" height="14" rx="1" />
      <line x1="850" y1="50" x2="850" y2="116" stroke="currentColor" strokeWidth="2" />
      <rect x="843" y="38" width="14" height="14" rx="1" />
      <line x1="1080" y1="60" x2="1080" y2="120" stroke="currentColor" strokeWidth="2" />
      <rect x="1073" y="48" width="14" height="14" rx="1" />
    </svg>
  )
}
