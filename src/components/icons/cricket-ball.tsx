import type { SVGProps } from "react"

export function CricketBall({ className, style, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
      {...props}
    >
      {/* Red ball */}
      <circle cx="12" cy="12" r="10" fill="#CC2200" />
      {/* Shine highlight */}
      <ellipse cx="8.5" cy="7.5" rx="2.5" ry="1.5" fill="#FF4422" opacity="0.5" transform="rotate(-30 8.5 7.5)" />
      {/* Vertical seam */}
      <path
        d="M12 2 Q14 7 14 12 Q14 17 12 22"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      <path
        d="M12 2 Q10 7 10 12 Q10 17 12 22"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      {/* Seam stitches */}
      <path
        d="M13.5 6 L14.8 5.2 M13.7 8.5 L15 7.7 M13.7 15.5 L15 16.3 M13.5 18 L14.8 18.8"
        stroke="white"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M10.5 6 L9.2 5.2 M10.3 8.5 L9 7.7 M10.3 15.5 L9 16.3 M10.5 18 L9.2 18.8"
        stroke="white"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  )
}
