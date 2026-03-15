export function AmbientGradient() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden dark:block hidden"
    >
      {/* Emerald orb — top left */}
      <div
        className="ambient-orb absolute -top-[20%] -left-[10%] h-[600px] w-[600px] rounded-full opacity-[0.12] blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.55 0.17 162.48), transparent 70%)",
          animation: "drift-1 25s ease-in-out infinite",
        }}
      />
      {/* Purple orb — bottom right */}
      <div
        className="ambient-orb absolute -bottom-[15%] -right-[10%] h-[500px] w-[500px] rounded-full opacity-[0.10] blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.55 0.20 300), transparent 70%)",
          animation: "drift-2 30s ease-in-out infinite",
        }}
      />
      {/* Blue orb — center */}
      <div
        className="ambient-orb absolute top-[30%] left-[40%] h-[400px] w-[400px] rounded-full opacity-[0.08] blur-[100px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.50 0.15 260), transparent 70%)",
          animation: "drift-3 20s ease-in-out infinite",
        }}
      />
    </div>
  )
}
