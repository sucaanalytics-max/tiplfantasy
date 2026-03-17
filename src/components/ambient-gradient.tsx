export function AmbientGradient() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden dark:block hidden"
    >
      {/* Deep indigo orb — top left */}
      <div
        className="ambient-orb absolute -top-[20%] -left-[10%] h-[600px] w-[600px] rounded-full opacity-[0.12] blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.45 0.18 275), transparent 70%)",
          animation: "drift-1 25s ease-in-out infinite",
        }}
      />
      {/* Warm orange-red orb — bottom right */}
      <div
        className="ambient-orb absolute -bottom-[15%] -right-[10%] h-[500px] w-[500px] rounded-full opacity-[0.10] blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.55 0.20 35), transparent 70%)",
          animation: "drift-2 30s ease-in-out infinite",
        }}
      />
      {/* Purple-indigo orb — center */}
      <div
        className="ambient-orb absolute top-[30%] left-[40%] h-[400px] w-[400px] rounded-full opacity-[0.08] blur-[100px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.45 0.15 290), transparent 70%)",
          animation: "drift-3 20s ease-in-out infinite",
        }}
      />
    </div>
  )
}
