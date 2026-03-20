"use client"

import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function CricketFieldLines() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none"
      viewBox="0 0 800 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* Outer boundary */}
      <ellipse cx="400" cy="450" rx="380" ry="420" fill="none" stroke="#EF4123" strokeWidth="1" />
      {/* 30-yard circle */}
      <ellipse cx="400" cy="450" rx="220" ry="240" fill="none" stroke="#EF4123" strokeWidth="1" />
      {/* Inner circle */}
      <ellipse cx="400" cy="450" rx="100" ry="110" fill="none" stroke="#D4A017" strokeWidth="1" />
      {/* Pitch rectangle */}
      <rect x="375" y="280" width="50" height="340" fill="none" stroke="#D4A017" strokeWidth="1" rx="4" />
      {/* Crease lines */}
      <line x1="360" y1="330" x2="440" y2="330" stroke="#D4A017" strokeWidth="1" />
      <line x1="360" y1="570" x2="440" y2="570" stroke="#D4A017" strokeWidth="1" />
      {/* Centre line */}
      <line x1="400" y1="30" x2="400" y2="870" stroke="#EF4123" strokeWidth="0.5" />
      <line x1="20" y1="450" x2="780" y2="450" stroke="#EF4123" strokeWidth="0.5" />
    </svg>
  )
}

function LoginForm() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  const handleGoogleLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden bg-[#060d18]">
      {/* Cricket field background */}
      <CricketFieldLines />

      {/* Ambient glow — orange top center */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      {/* Ambient glow — gold bottom right */}
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent/6 rounded-full blur-[100px] pointer-events-none" />

      {/* Top orange gradient bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-primary/80 to-accent" />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-6 gap-8">

        {/* Logo section */}
        <div className="flex flex-col items-center gap-5 text-center">
          {/* Logo with glow */}
          <div className="relative flex items-center justify-center">
            {/* Ambient glow behind logo */}
            <div className="absolute w-40 h-40 bg-primary/20 blur-3xl rounded-full" />
            <Image
              src="/icons/icon-192.png"
              alt="TIPL Fantasy"
              width={120}
              height={120}
              className="relative drop-shadow-[0_4px_24px_oklch(0.68_0.22_35/0.55)]"
              priority
            />
          </div>

          {/* Brand name */}
          <div>
            <h1 className="text-5xl font-black italic tracking-tight font-display leading-none">
              <span className="text-primary">TIPL</span>{" "}
              <span className="text-foreground">Fantasy</span>
            </h1>
            <div className="flex items-center justify-center gap-2 mt-3">
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-primary/50" />
              <p className="text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
                IPL 2026 · Office Cricket
              </p>
              <span className="h-px w-8 bg-gradient-to-l from-transparent to-primary/50" />
            </div>
          </div>
        </div>

        {/* Login card */}
        <div className="w-full bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-6 space-y-4 shadow-[0_24px_64px_rgba(0,0,0,0.5)]">
          <div className="text-center space-y-0.5">
            <p className="text-sm font-semibold text-foreground">Welcome</p>
            <p className="text-xs text-muted-foreground">Sign in to pick your team</p>
          </div>

          {error && (
            <p className="text-sm text-center text-destructive flex items-center justify-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              Authentication failed. Please try again.
            </p>
          )}

          <Button
            onClick={handleGoogleLogin}
            className="h-12 w-full bg-white text-gray-900 hover:bg-gray-50 font-medium rounded-xl shadow-md"
          >
            <svg className="mr-2.5 h-5 w-5 shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/40 tracking-wide">
          INVITE ONLY · TIPL MEMBERS
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
