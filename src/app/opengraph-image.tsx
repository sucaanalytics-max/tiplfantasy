import { ImageResponse } from "next/og"

export const alt = "TIPL Fantasy — Office IPL 2026 Fantasy Cricket"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0a1220",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Orange-to-gold top bar */}
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            height: 6,
            background: "linear-gradient(to right, #EF4123, #D4A017)",
            display: "flex",
          }}
        />

        {/* TIPL badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              background: "#EF4123",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: -1,
            }}
          >
            T
          </div>
          <span style={{ color: "#D4A017", fontSize: 18, fontWeight: 600, letterSpacing: 5, display: "flex" }}>
            TIPL FANTASY
          </span>
        </div>

        {/* Main heading */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginBottom: 20 }}>
          <span style={{ fontSize: 88, fontWeight: 900, color: "white", lineHeight: 1 }}>
            TIPL
          </span>
          <span style={{ fontSize: 88, fontWeight: 900, color: "#EF4123", lineHeight: 1 }}>
            Fantasy
          </span>
        </div>

        {/* Subtitle */}
        <div style={{ display: "flex", fontSize: 28, color: "rgba(255,255,255,0.5)", marginBottom: 52 }}>
          Office IPL 2026 · Pick Your Dream Team · Compete with Colleagues
        </div>

        {/* Bottom tagline */}
        <div style={{ display: "flex", fontSize: 22, color: "rgba(212,160,23,0.8)", fontWeight: 500, letterSpacing: 2 }}>
          IPL 2026 · PICK YOUR TEAM
        </div>

        {/* Decorative right-side element */}
        <div
          style={{
            position: "absolute",
            right: 80,
            top: 80,
            bottom: 80,
            width: 3,
            background: "linear-gradient(to bottom, transparent, #EF4123 30%, #D4A017 70%, transparent)",
            borderRadius: 4,
            display: "flex",
          }}
        />
        <span
          style={{
            position: "absolute",
            right: 50,
            bottom: 40,
            color: "rgba(255,255,255,0.2)",
            fontSize: 14,
            display: "flex",
          }}
        >
          tiplfantasy.vercel.app
        </span>
      </div>
    ),
    { ...size }
  )
}
