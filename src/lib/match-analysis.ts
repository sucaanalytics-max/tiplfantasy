// Pre-match analysis: pick ownership, C/VC chart, differentials, threats

export interface PlayerPick {
  id: string
  name: string
  role: string
  team: string
  owners: string[]         // display names of users who picked this player
  ownerCount: number
  ownership: number        // percentage
  status: "UNIVERSAL" | "CORE" | "COMMON" | "SPLIT" | "DIFF" | "UNIQUE"
}

export interface UserAnalysis {
  displayName: string
  captainId: string | null
  vcId: string | null
  captainName: string | null
  vcName: string | null
  playerIds: string[]
  missing: { name: string; ownership: number; ownerCount: number }[]  // highly owned players they don't have
  unique: string[]          // players only they have
}

// Matrix cell: what role does this player have in this user's team?
export type MatrixCell = "C" | "VC" | "picked" | null

export interface CaptainPick {
  playerName: string
  owners: string[]
  count: number
  percentage: number
}

export interface PreMatchAnalysis {
  matchLabel: string
  totalMembers: number
  picks: PlayerPick[]
  captains: CaptainPick[]
  viceCaptains: CaptainPick[]
  noCaptain: string[]       // users with no C (auto-pick)
  users: UserAnalysis[]
}

function pickStatus(ownership: number, totalMembers: number, ownerCount: number): PlayerPick["status"] {
  if (ownerCount === totalMembers) return "UNIVERSAL"
  if (ownership >= 80) return "CORE"
  if (ownership >= 60) return "COMMON"
  if (ownership >= 40) return "SPLIT"
  if (ownerCount === 1) return "UNIQUE"
  return "DIFF"
}

export function buildAnalysis(
  matchLabel: string,
  selections: Array<{
    displayName: string
    captainId: string | null
    viceCaptainId: string | null
    captainName: string | null
    vcName: string | null
    players: Array<{ id: string; name: string; role: string; team: string }>
  }>,
  excludeNames: string[] = []
): PreMatchAnalysis {
  // Filter out excluded members
  const filtered = excludeNames.length > 0
    ? selections.filter((s) => !excludeNames.includes(s.displayName))
    : selections
  const totalMembers = filtered.length

  // Build pick frequency map
  const playerMap = new Map<string, { name: string; role: string; team: string; owners: string[] }>()
  for (const sel of filtered) {
    for (const p of sel.players) {
      const existing = playerMap.get(p.id)
      if (existing) {
        existing.owners.push(sel.displayName)
      } else {
        playerMap.set(p.id, { name: p.name, role: p.role, team: p.team, owners: [sel.displayName] })
      }
    }
  }

  const picks: PlayerPick[] = [...playerMap.entries()]
    .map(([id, p]) => ({
      id,
      name: p.name,
      role: p.role,
      team: p.team,
      owners: p.owners,
      ownerCount: p.owners.length,
      ownership: Math.round((p.owners.length / totalMembers) * 100),
      status: pickStatus(Math.round((p.owners.length / totalMembers) * 100), totalMembers, p.owners.length),
    }))
    .sort((a, b) => b.ownerCount - a.ownerCount || a.name.localeCompare(b.name))

  // Captain picks
  const captainMap = new Map<string, { playerName: string; owners: string[] }>()
  const vcMap = new Map<string, { playerName: string; owners: string[] }>()
  const noCaptain: string[] = []

  for (const sel of filtered) {
    if (sel.captainId && sel.captainName) {
      const c = captainMap.get(sel.captainId)
      if (c) c.owners.push(sel.displayName)
      else captainMap.set(sel.captainId, { playerName: sel.captainName, owners: [sel.displayName] })
    } else {
      noCaptain.push(sel.displayName)
    }
    if (sel.viceCaptainId && sel.vcName) {
      const v = vcMap.get(sel.viceCaptainId)
      if (v) v.owners.push(sel.displayName)
      else vcMap.set(sel.viceCaptainId, { playerName: sel.vcName, owners: [sel.displayName] })
    }
  }

  const toCaptainPicks = (map: Map<string, { playerName: string; owners: string[] }>): CaptainPick[] =>
    [...map.values()]
      .map((c) => ({ playerName: c.playerName, owners: c.owners, count: c.owners.length, percentage: Math.round((c.owners.length / totalMembers) * 100) }))
      .sort((a, b) => b.count - a.count)

  // Per-user analysis
  const users: UserAnalysis[] = filtered.map((sel) => {
    const myIds = new Set(sel.players.map((p) => p.id))
    // Missing: players owned by 40%+ of the league that this user doesn't have
    const missing = picks
      .filter((p) => !myIds.has(p.id) && p.ownership >= 40)
      .map((p) => ({ name: p.name, ownership: p.ownership, ownerCount: p.ownerCount }))
      .sort((a, b) => b.ownership - a.ownership)

    // Unique: players only this user has
    const unique = picks.filter((p) => p.ownerCount === 1 && p.owners[0] === sel.displayName).map((p) => p.name)

    return {
      displayName: sel.displayName,
      captainId: sel.captainId,
      vcId: sel.viceCaptainId,
      captainName: sel.captainName,
      vcName: sel.vcName,
      playerIds: sel.players.map((p) => p.id),
      missing,
      unique,
    }
  })

  return {
    matchLabel,
    totalMembers,
    picks,
    captains: toCaptainPicks(captainMap),
    viceCaptains: toCaptainPicks(vcMap),
    noCaptain,
    users,
  }
}

export function formatPreMatchWhatsApp(analysis: PreMatchAnalysis): string {
  const { matchLabel, totalMembers, picks, captains, viceCaptains, noCaptain, users } = analysis
  const lines: string[] = []

  lines.push(`🏏 TUSK LEAGUE — ${matchLabel}`)
  lines.push(`Pre-Match Intelligence Report`)
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━`)
  lines.push(``)

  // Pick ownership table
  lines.push(`📊 PICK OWNERSHIP (${totalMembers} members)`)
  lines.push(``)
  const statusEmoji: Record<string, string> = { UNIVERSAL: "🟢", CORE: "🔵", COMMON: "🟡", SPLIT: "🟠", DIFF: "🔴", UNIQUE: "🔥" }
  for (const p of picks) {
    const pad = (s: string, n: number) => s.padEnd(n)
    lines.push(`${statusEmoji[p.status]} ${pad(p.name, 20)} ${pad(p.team, 4)} ${p.ownerCount}/${totalMembers} (${p.ownership}%) ${p.status}`)
  }
  lines.push(``)

  // C/VC table
  lines.push(`👑 CAPTAINCY TABLE`)
  lines.push(``)
  lines.push(`Captain:`)
  for (const c of captains) {
    lines.push(`  ${c.playerName} → ${c.count}/${totalMembers} (${c.percentage}%) — ${c.owners.join(", ")}`)
  }
  if (noCaptain.length > 0) {
    lines.push(`  No Captain ⚠️ → ${noCaptain.length}/${totalMembers} — ${noCaptain.join(", ")}`)
  }
  lines.push(``)
  lines.push(`Vice Captain:`)
  for (const v of viceCaptains) {
    lines.push(`  ${v.playerName} → ${v.count}/${totalMembers} (${v.percentage}%) — ${v.owners.join(", ")}`)
  }
  if (noCaptain.length > 0) {
    lines.push(`  No VC ⚠️ → ${noCaptain.length}/${totalMembers} — ${noCaptain.join(", ")}`)
  }
  lines.push(``)

  // Key differentials
  const diffs = picks.filter((p) => p.status === "DIFF" || p.status === "SPLIT" || p.status === "UNIQUE")
  if (diffs.length > 0) {
    lines.push(`⚡ KEY DIFFERENTIALS`)
    lines.push(``)
    for (const d of diffs) {
      if (d.status === "UNIQUE") {
        lines.push(`🔥 ${d.name} (${d.ownership}%) — ONLY ${d.owners[0]}`)
      } else {
        const haveNames = d.owners.join(", ")
        lines.push(`${d.name} (${d.ownership}%) — ${haveNames} HAVE`)
      }
    }
    lines.push(``)
  }

  // Per-user threats
  lines.push(`🎯 THREATS PER USER`)
  lines.push(``)
  for (const u of users) {
    lines.push(`*${u.displayName}*${u.captainName ? ` (C: ${u.captainName})` : " ⚠️ No Captain"}`)
    if (u.missing.length > 0) {
      lines.push(`  Missing: ${u.missing.map((m) => `${m.name} (${m.ownership}%)`).join(", ")}`)
    } else {
      lines.push(`  Missing: None — full coverage`)
    }
    if (u.unique.length > 0) {
      lines.push(`  Unique: ${u.unique.join(", ")} 🔥`)
    }
    lines.push(``)
  }

  // Storylines
  lines.push(`🔑 KEY STORYLINES`)
  lines.push(``)
  // Auto-generate storylines from data
  // 1. Contrarian captains
  const topCaptain = captains[0]
  const contrarians = captains.filter((c) => c.count === 1 && c.playerName !== topCaptain?.playerName)
  for (const c of contrarians) {
    lines.push(`• ${c.owners[0]}'s contrarian ${c.playerName} (C) — if ${c.playerName} outscores ${topCaptain?.playerName ?? "the field"} at 2x, massive swing`)
  }
  // 2. No captain penalty
  for (const name of noCaptain) {
    lines.push(`• ${name} has no Captain/VC — auto-pick penalty, no multiplier bonus`)
  }
  // 3. Players missing high-owned picks
  for (const u of users) {
    const bigMiss = u.missing.find((m) => m.ownership >= 80)
    if (bigMiss) {
      lines.push(`• ${u.displayName} is the ONLY one without ${bigMiss.name} (${bigMiss.ownership}%) — massive exposure if ${bigMiss.name} fires`)
    }
  }
  // 4. Unique picks
  const uniqueUsers = users.filter((u) => u.unique.length >= 2)
  for (const u of uniqueUsers) {
    lines.push(`• ${u.displayName}'s wildcard XI — ${u.unique.join(" + ")} = high-variance play`)
  }

  lines.push(``)
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━`)

  return lines.join("\n")
}
