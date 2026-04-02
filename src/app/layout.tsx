import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Rajdhani } from "next/font/google"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { ServiceWorkerRegistration } from "@/components/sw-register"
import { Analytics } from "@vercel/analytics/next"
import { AmbientGradient } from "@/components/ambient-gradient"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "TIPL Fantasy",
  description: "Office IPL 2026 Fantasy Cricket",
  manifest: "/manifest.json",
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "TIPL Fantasy",
    description: "Office IPL 2026 Fantasy Cricket — Pick your team, compete with colleagues",
    type: "website",
    url: "https://tiplfantasy.vercel.app",
    siteName: "TIPL Fantasy",
  },
  twitter: {
    card: "summary_large_image",
    title: "TIPL Fantasy",
    description: "Office IPL 2026 Fantasy Cricket — Pick your team, compete with colleagues",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TIPL",
    startupImage: [
      {
        url: "/icons/splash-1170x2532.png",
        media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/icons/splash-1284x2778.png",
        media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/icons/splash-1179x2556.png",
        media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)",
      },
    ],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1220" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${rajdhani.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AmbientGradient />
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
        <ServiceWorkerRegistration />
        <Analytics />
      </body>
    </html>
  )
}
