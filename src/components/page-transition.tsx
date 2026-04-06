export function PageTransition({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in">{children}</div>
}

// Staggered container + item variants for lists (framer-motion)
export const staggerContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.04 },
  },
}

export const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
}
