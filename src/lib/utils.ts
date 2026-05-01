import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const IST_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

/** Convert a UTC date string to a Date whose local values equal IST values */
export function toIST(dateStr: string): Date {
  const parts = IST_FORMATTER.formatToParts(new Date(dateStr))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00"
  // Construct without timezone suffix so Date() parses as local — matching whatever timezone
  // the runtime uses, ensuring date-fns format() reads the IST component values correctly.
  return new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`
  )
}

/** Format a UTC date string in IST using a date-fns format string */
export function formatIST(dateStr: string, fmt: string): string {
  return format(toIST(dateStr), fmt)
}
