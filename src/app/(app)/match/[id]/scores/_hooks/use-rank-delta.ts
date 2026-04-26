"use client"

import { useEffect, useRef } from "react"

/**
 * Track per-user rank changes between renders (i.e. between 30s polls).
 *
 * Returns a Map<user_id, delta>:
 *   - positive  → rank improved (e.g. went from #5 to #3 → +2)
 *   - negative  → rank worsened
 *   - zero      → unchanged
 *
 * Returns 0 for users we haven't seen before (so first paint shows no arrows).
 */
export function useRankDelta(
  userScores: Array<{ user_id: string; rank: number | null }>,
): Map<string, number> {
  const previousRanks = useRef<Map<string, number>>(new Map())
  const deltas = new Map<string, number>()

  for (const u of userScores) {
    const cur = u.rank
    if (cur == null) continue
    const prev = previousRanks.current.get(u.user_id)
    if (prev == null) {
      deltas.set(u.user_id, 0)
    } else {
      // Rank improvement = previous - current (smaller rank = better)
      deltas.set(u.user_id, prev - cur)
    }
  }

  // Update the cache after we've computed deltas for this render.
  useEffect(() => {
    const next = new Map<string, number>()
    for (const u of userScores) {
      if (u.rank != null) next.set(u.user_id, u.rank)
    }
    previousRanks.current = next
  }, [userScores])

  return deltas
}
