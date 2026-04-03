import { generateText } from "./ai"

const NICKNAMES: Record<string, string> = {
  "JVB": "JVB",
  "Anup Agarwal": "Anup",
  "sidd k": "Kanodia",
  "Abhishek Biyani": "Biyani",
  "Shreevar Todi": "Shreevar",
  "DJ Large Cap": "Saket",
}

function nick(displayName: string): string {
  return NICKNAMES[displayName] ?? displayName
}

export type MatchBanterContext = {
  matchNumber: number
  home: string
  away: string
  resultSummary: string | null
  standings: Array<{
    name: string
    points: number
    rank: number
    captainName: string | null
    captainPoints: number
    viceCaptainName: string | null
    viceCaptainPoints: number
  }>
  topScorer: { name: string; runs: number; balls: number; pts: number } | null
  bestBowler: { name: string; wickets: number; runs: number; overs: number; pts: number } | null
  highestFantasy: { name: string; pts: number } | null
  differentials: Array<{ playerName: string; pts: number; pickedBy: number; totalUsers: number }>
  worstCaptain: { ownerName: string; playerName: string; pts: number } | null
}

export async function generatePostMatchBanter(ctx: MatchBanterContext): Promise<string[]> {
  const standings = ctx.standings
    .sort((a, b) => a.rank - b.rank)
    .map((s) => {
      let line = `${s.rank}. ${nick(s.name)} — ${s.points} pts`
      if (s.captainName) line += ` (C: ${s.captainName} → ${s.captainPoints} base pts)`
      if (s.viceCaptainName) line += ` (VC: ${s.viceCaptainName} → ${s.viceCaptainPoints} base pts)`
      return line
    })
    .join("\n")

  const moments: string[] = []
  if (ctx.topScorer) moments.push(`Top Scorer: ${ctx.topScorer.name} — ${ctx.topScorer.runs}(${ctx.topScorer.balls}), ${ctx.topScorer.pts} fantasy pts`)
  if (ctx.bestBowler) moments.push(`Best Bowler: ${ctx.bestBowler.name} — ${ctx.bestBowler.wickets}/${ctx.bestBowler.runs} (${ctx.bestBowler.overs} ov), ${ctx.bestBowler.pts} fantasy pts`)
  if (ctx.highestFantasy) moments.push(`Highest Fantasy: ${ctx.highestFantasy.name} — ${ctx.highestFantasy.pts} pts`)
  if (ctx.worstCaptain) moments.push(`Worst Captain Pick: ${nick(ctx.worstCaptain.ownerName)} captained ${ctx.worstCaptain.playerName} who scored ${ctx.worstCaptain.pts} pts`)
  for (const d of ctx.differentials) {
    moments.push(`Differential: ${d.playerName} scored ${d.pts} pts but only ${d.pickedBy}/${d.totalUsers} picked him`)
  }

  const lastPlace = ctx.standings[ctx.standings.length - 1]
  if (lastPlace) moments.push(`Last Place: ${nick(lastPlace.name)} with ${lastPlace.points} pts`)

  const prompt = `You are "Baba T", the savage but lovable banter master of an office fantasy cricket league called TIPL (The IPL Pool).

MATCH #${ctx.matchNumber}: ${ctx.home} vs ${ctx.away}
Result: ${ctx.resultSummary ?? "Unknown"}

FANTASY STANDINGS (Tusk League):
${standings}

KEY MOMENTS:
${moments.map((m) => `- ${m}`).join("\n")}

PLAYER NICKNAMES (use these, NOT display names):
${Object.entries(NICKNAMES).map(([display, nick]) => `${display} → "${nick}"`).join(", ")}

Generate exactly 8 banter/roast lines for the post-match WhatsApp memo. Rules:
- Use NICKNAMES (Kanodia, Biyani, Anup, Shreevar, JVB, Saket) — never use display names
- Reference SPECIFIC scores, captain picks, rankings, and player performances from the data above
- Mix tones: office roast ("that captain pick aged like milk"), cricket commentary ("more dots than a dalmatian"), desi WhatsApp uncle ("beta next time pick players who bat")
- Each line must target a specific user or moment — NO generic filler
- Be savage but friendly — these are colleagues who trash-talk daily
- Keep each line to 1-2 sentences max
- Do NOT number the lines or use bullet points — just one line per banter
- Do NOT use asterisks or markdown formatting`

  const response = await generateText(prompt)
  if (!response) return []

  const lines = response
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 10 && !l.startsWith("#") && !l.startsWith("-") && !l.match(/^\d+\./))

  return lines.slice(0, 8)
}
