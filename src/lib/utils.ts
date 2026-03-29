import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Convert a UTC date string to IST (UTC+5:30) and format with date-fns */
export function formatIST(dateStr: string, fmt: string): string {
  const utc = new Date(dateStr)
  const ist = new Date(utc.getTime() + 5.5 * 60 * 60 * 1000)
  return format(ist, fmt)
}

/** Convert a UTC date string to IST Date object */
export function toIST(dateStr: string): Date {
  const utc = new Date(dateStr)
  return new Date(utc.getTime() + 5.5 * 60 * 60 * 1000)
}
