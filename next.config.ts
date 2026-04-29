import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  turbopack: {},
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  images: {
    // Allow Supabase Storage public URLs (player headshots in player-photos bucket)
    // and Sportmonks CDN as a fallback if a player image_url ever points there directly.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "cdn.sportmonks.com", pathname: "/**" },
    ],
  },
}

export default nextConfig
