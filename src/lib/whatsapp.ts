type MatchResult = {
  displayName: string
  totalPoints: number
  rank: number
}

type SeasonEntry = {
  displayName: string
  totalPoints: number
}

export function formatMatchMessage(
  matchTitle: string,
  matchNumber: number,
  results: MatchResult[],
  seasonTop5: SeasonEntry[]
): string {
  const sorted = [...results].sort((a, b) => a.rank - b.rank)

  const medals = ["🥇", "🥈", "🥉"]
  const lines: string[] = [
    `🏏 *TIPL Match ${matchNumber}*`,
    `${matchTitle}`,
    "",
    "*Results:*",
  ]

  sorted.forEach((r, i) => {
    const prefix = i < 3 ? medals[i] : i === sorted.length - 1 ? "🥄" : `${i + 1}.`
    lines.push(`${prefix} ${r.displayName} — ${r.totalPoints} pts`)
  })

  if (seasonTop5.length > 0) {
    lines.push("")
    lines.push("*Season Standings:*")
    seasonTop5.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.displayName} — ${s.totalPoints} pts`)
    })
  }

  lines.push("")
  lines.push("_TIPL Fantasy 2026_")

  return lines.join("\n")
}
