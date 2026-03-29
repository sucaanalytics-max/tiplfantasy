/**
 * Banter Template Engine — generates witty cricket commentary
 * for fantasy league members based on player performance events.
 */

export type BanterEventType =
  | "duck"
  | "low_sr"
  | "expensive_bowling"
  | "wicketless"
  | "captain_fail"
  | "vc_fail"
  | "bottom_rank"
  | "century"
  | "fifty"
  | "three_plus_wickets"
  | "top_rank"
  | "ugly_dismissal"
  | "great_economy"
  | "captain_haul"

export type BanterEvent = {
  type: BanterEventType
  memberName: string
  playerName: string
  detail?: string // e.g. "0(3)", "1/52 (4 ov)", "SR 45.2"
}

type TemplatePool = Record<BanterEventType, string[]>

// {m} = member name, {p} = player name, {d} = detail
const TEMPLATES: TemplatePool = {
  duck: [
    "{m}, {p} spent less time on the pitch than it takes to cook 2-minute Maggi. Masterstroke scouting!",
    "{m}, your star pick {p} is out for a duck. Even the duck is embarrassed to be associated with this.",
    "Hey {m}, {p}'s innings lasted shorter than a Snapchat story. Truly inspirational.",
    "{m}, {p} walked in and walked right back out. Must've forgotten something in the dressing room.",
    "Breaking News: {m}'s pick {p} has scored a duck. Scientists are now studying how to achieve zero in T20 cricket.",
    "{m}, keeping {p} in your XI is pure charity. You're a good person with a truly terrible fantasy team.",
  ],

  low_sr: [
    "{m}, your star pick {p} is batting with the strike rate of a 2008 dial-up internet connection. Truly vintage stuff.",
    "{p}'s batting today makes watching paint dry seem like an adrenaline sport. Thoughts and prayers, {m}.",
    "{m}, {p} ({d}) is currently occupying the crease like it's a government job. No urgency whatsoever.",
    "Hey {m}, even your WiFi router delivers packets faster than {p} is scoring runs right now.",
  ],

  expensive_bowling: [
    "Congratulations {m}, {p} is on track for a spectacular century! Oh wait... those are runs conceded.",
    "{m}, your premium pacer {p} ({d}) is distributing runs like free prasad at a pandal. The whole league thanks you!",
    "{p} is being hit so far that NASA is tracking the ball. Top-tier pick, {m}!",
    "{m}, {p}'s bowling today is charity work. Someone should register it as a tax deduction.",
  ],

  wicketless: [
    "{p}'s heat map today looks like a vegetarian's plate at a Bengali wedding — absolutely empty. Tough luck, {m}.",
    "{m}, your star bowler {p} ({d}) has been as threatening as a wet noodle. Zero wickets, maximum vibes.",
    "Hey {m}, {p} bowled {d} without a single wicket. Even the batsmen felt bad for him.",
    "{m}, {p} is currently playing the role of a bowling machine. Just feeding balls, no wickets.",
  ],

  captain_fail: [
    "Making {p} your captain today is the cricketing equivalent of investing heavily in Blockbuster Video. Truly visionary, {m}.",
    "{m}, your captain {p} scored {d}. That's your 2x multiplier working overtime... on nothing.",
    "A moment of silence for {m}'s captaincy choice. {p} with a captain's knock of {d}. Inspirational.",
    "{m}, even a random number generator would've picked a better captain than {p} today.",
  ],

  vc_fail: [
    "Even Virat Kohli needs a rest day, {m}. Pity {p} chose the exact day you made them your Vice-Captain.",
    "{m}, your VC {p} scored {d}. The 1.5x multiplier is doing negative work.",
    "Hey {m}, your Vice-Captain {p} is giving you vice... as in suffering. {d} and counting down.",
  ],

  bottom_rank: [
    "A moment of silence for {m}'s fantasy team. It fought bravely against logic, stats, and common sense.",
    "Looking at your total points, {m}, I'm starting to think you drafted this team using a dartboard while blindfolded.",
    "{m}, look on the bright side. At least your fantasy team is consistently bad. You can't put a price on reliability!",
    "{m}, your team is currently in last place. The wooden spoon is being polished as we speak.",
  ],

  century: [
    "{m}'s pick {p} just scored a CENTURY! Time to take a bow and screenshot this for the group chat.",
    "ALERT: {p} has hit a hundred ({d})! {m} is currently smiling so wide it's visible from space.",
    "{m}, {p}'s century today makes your entire team look genius. Even a broken clock is right twice a day!",
  ],

  fifty: [
    "{p} smashes a half-century ({d})! {m}'s decision-making is briefly redeemed.",
    "Fair play to {m} — {p} just crossed fifty. Even we have to admit that was a good pick.",
    "{m}'s {p} with a solid fifty ({d}). The fantasy points are rolling in like it's payday.",
  ],

  three_plus_wickets: [
    "{p} is on FIRE with {d}! {m}, you absolute genius. We bow to your cricketing wisdom.",
    "WICKET ALERT: {p} has {d}! {m}'s bowling pick is dismantling the opposition.",
    "{m}'s {p} collecting wickets like Thanos collecting infinity stones. {d} and counting!",
  ],

  top_rank: [
    "{m} is currently sitting pretty at #1 in the league. Don't let it go to your head... too late.",
    "Crown alert! {m} leads the pack. Remember this moment — they'll remind you about it for weeks.",
    "{m} is on top! The rest of you, take notes. Or don't. They'll gladly teach you... for a fee.",
  ],

  ugly_dismissal: [
    "I've seen better footwork from a drunk uncle at a wedding than {p} showed just now. RIP your fantasy points, {m}.",
    "{m}, choosing {p} was a bold move. The kind of bold move that sinks the Titanic.",
    "That dismissal was so ugly it needs its own therapy session. Condolences, {m}.",
  ],

  great_economy: [
    "{m}'s {p} bowling tighter than a drum! Economy of {d}. Smart pick.",
    "{p} with an economy of {d} — miserly, stingy, and exactly what {m} ordered.",
    "The batsmen can't buy a run off {p} ({d}). {m} is collecting bonus points like loose change.",
  ],

  captain_haul: [
    "{m}'s CAPTAIN {p} just went berserk — {d}! That's 2x multiplier heaven!",
    "CAPTAIN'S KNOCK! {p} ({d}) is single-handedly carrying {m}'s fantasy team to glory.",
    "{m} made {p} captain and it PAID OFF. {d} at 2x. The rest of you can only watch and weep.",
  ],
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function generateBanter(event: BanterEvent): string {
  const templates = TEMPLATES[event.type]
  if (!templates || templates.length === 0) return ""

  let msg = pickRandom(templates)
  msg = msg.replace(/\{m\}/g, event.memberName)
  msg = msg.replace(/\{p\}/g, event.playerName)
  msg = msg.replace(/\{d\}/g, event.detail ?? "")
  return msg
}

/**
 * Detect banter-worthy events from player scoring data.
 * Returns an array of events to generate banter for.
 */
export function detectBanterEvents(
  playerStats: {
    player_id: string
    playerName: string
    runs: number
    balls_faced: number
    wickets: number
    overs_bowled: number
    runs_conceded: number
    fantasy_points: number
  },
  owner: {
    memberName: string
    isCaptain: boolean
    isViceCaptain: boolean
  }
): BanterEvent[] {
  const events: BanterEvent[] = []
  const { runs, balls_faced, wickets, overs_bowled, runs_conceded, fantasy_points } = playerStats
  const sr = balls_faced > 0 ? (runs / balls_faced) * 100 : 0
  const econ = overs_bowled > 0 ? runs_conceded / overs_bowled : 0

  // Batting events
  if (runs === 0 && balls_faced >= 1) {
    events.push({ type: "duck", memberName: owner.memberName, playerName: playerStats.playerName, detail: `0(${balls_faced})` })
  } else if (runs >= 100) {
    events.push({ type: "century", memberName: owner.memberName, playerName: playerStats.playerName, detail: `${runs}(${balls_faced})` })
  } else if (runs >= 50) {
    events.push({ type: "fifty", memberName: owner.memberName, playerName: playerStats.playerName, detail: `${runs}(${balls_faced})` })
  } else if (sr < 70 && runs > 0 && balls_faced >= 10) {
    events.push({ type: "low_sr", memberName: owner.memberName, playerName: playerStats.playerName, detail: `${runs}(${balls_faced}) SR ${sr.toFixed(0)}` })
  }

  // Bowling events
  if (overs_bowled >= 2) {
    if (wickets >= 3) {
      events.push({ type: "three_plus_wickets", memberName: owner.memberName, playerName: playerStats.playerName, detail: `${wickets}/${runs_conceded}` })
    } else if (wickets === 0 && overs_bowled >= 3) {
      events.push({ type: "wicketless", memberName: owner.memberName, playerName: playerStats.playerName, detail: `0/${runs_conceded} (${overs_bowled} ov)` })
    }

    if (econ > 11) {
      events.push({ type: "expensive_bowling", memberName: owner.memberName, playerName: playerStats.playerName, detail: `${wickets}/${runs_conceded} (${overs_bowled} ov)` })
    } else if (econ <= 5) {
      events.push({ type: "great_economy", memberName: owner.memberName, playerName: playerStats.playerName, detail: `econ ${econ.toFixed(1)}` })
    }
  }

  // Captain/VC events
  if (owner.isCaptain && fantasy_points < 15) {
    events.push({ type: "captain_fail", memberName: owner.memberName, playerName: playerStats.playerName, detail: `${fantasy_points} pts` })
  } else if (owner.isCaptain && fantasy_points >= 60) {
    events.push({ type: "captain_haul", memberName: owner.memberName, playerName: playerStats.playerName, detail: `${fantasy_points} pts at 2x` })
  }

  if (owner.isViceCaptain && fantasy_points < 10) {
    events.push({ type: "vc_fail", memberName: owner.memberName, playerName: playerStats.playerName, detail: `${fantasy_points} pts` })
  }

  return events
}

/**
 * Detect league-level banter (rank-based).
 */
export function detectRankBanter(
  memberName: string,
  leagueRank: number,
  leagueSize: number,
): BanterEvent | null {
  if (leagueRank === 1) {
    return { type: "top_rank", memberName, playerName: "", detail: "" }
  }
  if (leagueRank === leagueSize && leagueSize >= 3) {
    return { type: "bottom_rank", memberName, playerName: "", detail: "" }
  }
  return null
}

/**
 * Format a post-match memo for WhatsApp sharing.
 */
export function formatMatchMemo(
  matchNumber: number,
  homeTeam: string,
  awayTeam: string,
  resultSummary: string | null,
  rankedUsers: Array<{ name: string; points: number; captainName: string | null }>,
  banterMessages: string[],
): string {
  const medals = ["🥇", "🥈", "🥉"]
  const lines: string[] = []

  lines.push(`🏏 *TIPL MATCH #${matchNumber} MEMO* — ${homeTeam} vs ${awayTeam}`)
  if (resultSummary) lines.push(`_${resultSummary}_`)
  lines.push("")

  lines.push("📊 *Final Scores:*")
  for (let i = 0; i < rankedUsers.length; i++) {
    const u = rankedUsers[i]
    const medal = medals[i] ?? `#${i + 1}`
    const captainInfo = u.captainName ? ` (C: ${u.captainName})` : ""
    lines.push(`${medal} ${u.name} — ${u.points} pts${captainInfo}`)
  }
  lines.push("")

  if (banterMessages.length > 0) {
    lines.push("🎭 *Best Moments:*")
    for (const msg of banterMessages.slice(0, 6)) {
      lines.push(`• ${msg}`)
    }
    lines.push("")
  }

  if (rankedUsers.length > 0) {
    const last = rankedUsers[rankedUsers.length - 1]
    lines.push(`📉 *Wooden Spoon:* ${last.name} (${last.points} pts)`)
  }

  return lines.join("\n")
}
