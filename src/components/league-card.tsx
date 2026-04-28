"use client"

import Link from "next/link"
import { useState } from "react"
import { Crown, Users, Copy, Check, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  id: string
  name: string
  inviteCode: string
  memberCount: number
  /** True when the current user created the league (gets a crown). */
  isCreator?: boolean
  /** Optional enrichment — current top scorer's display name, e.g. "Anita". */
  topScorerName?: string | null
  /** Optional enrichment — average matchday points across the league. */
  avgPoints?: number | null
  className?: string
}

/**
 * Premium league overview card. Replaces the bare list rows on /leagues
 * with a card that surfaces invite code as a copyable chip, the creator
 * crown, member count, and (when fetched) league-wide stats like avg
 * points and current leader.
 *
 * Wraps the whole card in a <Link/> for tap-anywhere navigation, but
 * the invite-code chip swallows clicks so users can copy without
 * triggering a route change.
 */
export function LeagueCard({
  id,
  name,
  inviteCode,
  memberCount,
  isCreator,
  topScorerName,
  avgPoints,
  className,
}: Props) {
  const [copied, setCopied] = useState(false)

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Link
      href={`/leagues/${id}`}
      className={cn(
        "group block rounded-2xl glass glass-hover transition-all relative overflow-hidden",
        className
      )}
    >
      {/* Subtle accent backdrop — gold halo top-left */}
      <div
        aria-hidden
        className="absolute -top-12 -left-12 h-32 w-32 rounded-full pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(circle, var(--captain-gold-glow) 0%, transparent 70%)",
          filter: "blur(8px)",
        }}
      />

      <div className="relative px-4 py-4 flex items-start gap-3">
        {/* Crown disc — visually distinct affordance for the league */}
        <div className="shrink-0 mt-0.5 h-9 w-9 rounded-full bg-accent/15 text-accent flex items-center justify-center ring-1 ring-accent/25">
          <Crown className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-display font-bold text-base truncate">{name}</h3>
            {isCreator && (
              <span title="You created this league" className="text-amber-500 shrink-0">
                <Crown className="h-3.5 w-3.5" />
              </span>
            )}
          </div>

          {/* Member count + top scorer */}
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span className="font-display font-bold tabular-nums text-foreground">{memberCount}</span>
              <span>{memberCount === 1 ? "member" : "members"}</span>
            </span>
            {topScorerName && (
              <span className="inline-flex items-center gap-1">
                <Crown className="h-3 w-3 text-[var(--captain-gold)]" />
                <span className="truncate max-w-[110px] text-foreground">{topScorerName}</span>
              </span>
            )}
            {avgPoints != null && (
              <span className="inline-flex items-center gap-1">
                <span className="font-display font-bold tabular-nums text-foreground">{avgPoints.toFixed(1)}</span>
                <span>avg</span>
              </span>
            )}
          </div>

          {/* Invite code chip */}
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-mono uppercase tracking-widest transition-colors",
              copied
                ? "border-status-success/30 text-status-success bg-status-success-bg"
                : "border-overlay-border-hover text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
            aria-label="Copy invite code"
          >
            <span>{inviteCode}</span>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-2.5 w-2.5" />}
          </button>
        </div>

        {/* Chevron — appears on hover for tap-anywhere affordance */}
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 mt-2 shrink-0 group-hover:text-muted-foreground transition-colors" />
      </div>
    </Link>
  )
}
