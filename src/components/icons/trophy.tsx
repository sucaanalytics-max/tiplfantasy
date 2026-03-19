import type { SVGProps } from "react"

export function Trophy({ className, style, ...props }: SVGProps<SVGSVGElement>) {
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
      {/* Cup body */}
      <path
        d="M6 2H18V10C18 13.314 15.314 16 12 16C8.686 16 6 13.314 6 10V2Z"
        fill="#F59E0B"
        stroke="#D97706"
        strokeWidth="0.5"
      />
      {/* Cup handles */}
      <path d="M6 4H3C3 4 2 8 5 9" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M18 4H21C21 4 22 8 19 9" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Stem */}
      <rect x="11" y="16" width="2" height="4" fill="#F59E0B" />
      {/* Base */}
      <rect x="8" y="20" width="8" height="2" rx="1" fill="#F59E0B" stroke="#D97706" strokeWidth="0.5" />
      {/* Shine */}
      <path
        d="M9 4 Q10 3 11 4 Q10 7 9 8 Q8 7 9 4Z"
        fill="white"
        opacity="0.25"
      />
      {/* Star in cup */}
      <path
        d="M12 5.5L12.8 8H15.2L13.2 9.5L14 12L12 10.5L10 12L10.8 9.5L8.8 8H11.2L12 5.5Z"
        fill="white"
        opacity="0.4"
      />
    </svg>
  )
}
