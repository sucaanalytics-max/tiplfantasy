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
  | "general_roast"
  | "auto_pick_shame"
  | "comeback"

export type BanterEvent = {
  type: BanterEventType
  memberName: string  // single name or pre-joined string
  memberNames?: string[]  // multiple owners for grouped banter
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
    "A golden duck! {m}'s star player {p}'s chart is looking like a 90% market correction.",
    "{m}'s {p} just gave a worse ROI than an NFT. Zero runs, infinite disappointment.",
    "Ye toh shuru hote hi khatam ho gaya. {m}'s star pick {p} — gone before the crowd even sat down.",
    "{m}, aapse better umeed thi. {p} scored {d}. Looking at your expensive marquee player like...",
  ],

  low_sr: [
    "{m}, your star pick {p} is batting with the strike rate of a 2008 dial-up internet connection. Truly vintage stuff.",
    "{p}'s batting today makes watching paint dry seem like an adrenaline sport. Thoughts and prayers, {m}.",
    "{m}, {p} ({d}) is currently occupying the crease like it's a government job. No urgency whatsoever.",
    "Hey {m}, even your WiFi router delivers packets faster than {p} is scoring runs right now.",
    "{p} scored a quick few, but the strike rate penalty means {m} is basically paying capital gains tax on it.",
    "Picking {p} at that SR is the fantasy equivalent of buying high and selling low. Classic {m}.",
  ],

  expensive_bowling: [
    "Congratulations {m}, {p} is on track for a spectacular century! Oh wait... those are runs conceded.",
    "{m}, your premium pacer {p} ({d}) is distributing runs like free prasad at a pandal. The whole league thanks you!",
    "{p} is being hit so far that NASA is tracking the ball. Top-tier pick, {m}!",
    "{m}, {p}'s bowling today is charity work. Someone should register it as a tax deduction.",
    "{m}'s bowler {p}'s economy rate is currently higher than the national inflation rate.",
    "{p} got a wicket but went for 50 runs. That's a toxic asset disguised as a return. Well played, {m}.",
  ],

  wicketless: [
    "{p}'s heat map today looks like a vegetarian's plate at a Bengali wedding — absolutely empty. Tough luck, {m}.",
    "{m}, your star bowler {p} ({d}) has been as threatening as a wet noodle. Zero wickets, maximum vibes.",
    "Hey {m}, {p} bowled {d} without a single wicket. Even the batsmen felt bad for him.",
    "{m}, {p} is currently playing the role of a bowling machine. Just feeding balls, no wickets.",
    "I've seen better defensive strategies from hedge funds right before they blew up. {m}'s {p}: {d}.",
  ],

  captain_fail: [
    "Making {p} your captain today is the cricketing equivalent of investing heavily in Blockbuster Video. Truly visionary, {m}.",
    "{m}, your captain {p} scored {d}. That's your 2x multiplier working overtime... on nothing.",
    "A moment of silence for {m}'s captaincy choice. {p} with a captain's knock of {d}. Inspirational.",
    "{m}, even a random number generator would've picked a better captain than {p} today.",
    "{m} put all liquidity into captain {p}, and the market crashed. {d}. Textbook systemic risk.",
    "Making {p} captain was a highly speculative asset class, and {m} just got liquidated.",
    "{m}'s captain {p}'s stock just got delisted from the IPL. {d}.",
    "{m} double-downed on {p} as Captain? That's not a diversified portfolio, that's degenerate gambling.",
    "Ye dukh kaahe khatam nahi hota be! {m}'s captain {p} scored {d}. 2x of pain.",
    "Manager se zyada umeed toh {m} ko apne Captain {p} se thi, dono ne dhoka de diya.",
  ],

  vc_fail: [
    "Even Virat Kohli needs a rest day, {m}. Pity {p} chose the exact day you made them your Vice-Captain.",
    "{m}, your VC {p} scored {d}. The 1.5x multiplier is doing negative work.",
    "Hey {m}, your Vice-Captain {p} is giving you vice... as in suffering. {d} and counting down.",
    "{m}'s Vice-Captain {p} is currently yielding negative interest. {d}. Impressive.",
    "I'd ask who {m}'s financial advisor is, but clearly VC {p} embezzled all the capital.",
    "Mera Vice-Captain negative mein kyu hai bhai? {m}'s VC {p}: {d}.",
    "Bhai kya kar raha hai tu, {m}? VC {p} at {d}. Bizarre vice-captaincy choice.",
  ],

  bottom_rank: [
    "A moment of silence for {m}'s fantasy team. It fought bravely against logic, stats, and common sense.",
    "Looking at your total points, {m}, I'm starting to think you drafted this team using a dartboard while blindfolded.",
    "{m}, look on the bright side. At least your fantasy team is consistently bad. You can't put a price on reliability!",
    "{m}, your team is currently in last place. The wooden spoon is being polished as we speak.",
    "Looking at the leaderboard, {m}'s team is definitely classified as a Non-Performing Asset.",
    "{m} is deep in the red. Time to ask the league commissioner for a bailout.",
    "{m}'s rank is dropping faster than the Rupee against the Dollar.",
    "{m}'s team is the Evergrande of this league. Massively hyped, deeply in debt, completely collapsing.",
    "Congratulations {m}, your fantasy team has officially reached junk bond status.",
    "If {m}'s fantasy team was a startup, the VCs would have fired them as CEO by week two.",
    "{m}, beta tumse na ho payega.",
    "Tareekh pe tareekh, par jeet nahi aayi! {m} promises to bounce back every week but fails.",
    "Is performance par toh {m} ko appraisal definitely nahi milega.",
    "{m} ka fantasy score uske CTC se bhi slow badh raha hai.",
    "{m}'s fantasy strategy desperately needs a PIP (Performance Improvement Plan).",
    "Let's take this offline, {m}. Your rank is too embarrassing for the main group chat.",
    "Team aisi banao ki HR bhi notice period de de, {m}.",
    "\"As per my last email,\" {m}'s team is still trash.",
    "Circle back to me when {m} crosses the 50-point mark for the day.",
    "Fantasy points aur promotion, dono sirf sapno mein hi milte hain. Right, {m}?",
    "{m} ka ROI (Return on Investment) minus mein chal raha hai.",
    "At the end of the day, it is what it is — zero points for {m}.",
    "Please put {m}'s fantasy skills on mute.",
    "{m}, did you get this team approved by the client, or did you just make it blindfolded?",
    "Need an ETA on when {m}'s players will actually start performing.",
    "Fantasy league chhod, {m} tu canteen mein Ludo khel le.",
    "{m} ka rank dekh ke toh bottom table walo ko bhi confidence aa gaya.",
    "Points table mein {m} aisi jagah hai ki wahan tak scroll karne mein ungli dard karti hai.",
    "{m} tu match dekhne aata hai ya sirf leaderboard pe rone?",
    "{m} bhai tu dream team bana raha hai ya nightmare?",
    "{m} ki team ke players ground pe nahi, hospital mein hone chahiye.",
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
    "{m}'s current league rank is providing great liquidity for the rest of us. Thanks for the free points! Oh wait, they're WINNING.",
    "Rishte mein toh hum tumhare baap lagte hain, naam hai... Table Topper. — {m}",
    "Hum jahan khade hote hain, leaderboard wahi se shuru hoti hai. — {m}",
    "Jalwa hai hamara yahan. — {m} asserting dominance.",
    "Ghamand kis baat ka hai bhai? Oh wait, {m} is actually #1. Carry on.",
    "Control Uday, control! {m} is getting overexcited after one good match.",
  ],

  ugly_dismissal: [
    "I've seen better footwork from a drunk uncle at a wedding than {p} showed just now. RIP your fantasy points, {m}.",
    "{m}, choosing {p} was a bold move. The kind of bold move that sinks the Titanic.",
    "That dismissal was so ugly it needs its own therapy session. Condolences, {m}.",
    "Picking {p} that fast? {m} saw a dead cat bounce and went all in.",
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

  general_roast: [
    "Utha le re baba, mereko nahi... {m} ke points ko!",
    "Parampara, Pratishtha, Anushasan... {m} ki team mein teeno nahi hain.",
    "Tauba tauba, {m} ne saara mood kharab kar diya. Checking rank first thing in the morning.",
    "Tukka lag gaya {m} ka, aur kuch nahi.",
    "Pitch report padh liya kar {m}, family group ke WhatsApp forward nahi.",
    "{m} ne team nahi, NGO banaya hai, sabko aage badhne ke points daan de raha hai.",
    "Chhoti bacchi ho kya, {m}? Stop blaming the pitch.",
    "Ye toss ke baad edit karna bhool gaya tha kya, {m}?",
    "Apna time aayega, {m}... shayad agle season mein.",
    "Please send a calendar invite before {m}'s team decides to score some points.",
    "{m}, jisko maine drop kiya, usne aaj pakka century maarni hai.",
    "Captain banaya tha Kohli ko, perform kar raha hai {m} ka luck.",
  ],

  auto_pick_shame: [
    "Dekh raha hai Binod, kaise {m} auto-pick karke point loote jaa rahe hain.",
    "Auto-pick wali team se haar gaya main? {m} ki zindagi barbad hai.",
    "{m} didn't even pick a team and still scored more than you. Let that sink in.",
  ],

  comeback: [
    "Haar kar jeetne wale ko baazigar kehte hain. {m} with the epic comeback!",
    "Abhi hum zinda hain! {m} crawling out of the bottom half.",
    "Ye Baburao ka style hai. {m}'s risky, out-of-the-box pick actually worked out.",
    "Jigar maa badi aag hai! An unknown tailender single-handedly saved {m}'s fantasy team.",
  ],
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Join names with commas and "&" before the last: "A, B & C" */
function joinNames(names: string[]): string {
  if (names.length === 0) return ""
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`
}

export function generateBanter(event: BanterEvent): string {
  const templates = TEMPLATES[event.type]
  if (!templates || templates.length === 0) return ""

  const displayName = event.memberNames && event.memberNames.length > 0
    ? joinNames(event.memberNames)
    : event.memberName

  let msg = pickRandom(templates)
  msg = msg.replace(/\{m\}/g, displayName)
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
  prevRank?: number | null,
): BanterEvent | null {
  if (leagueRank === 1) {
    return { type: "top_rank", memberName, playerName: "", detail: "" }
  }
  if (leagueRank === leagueSize && leagueSize >= 3) {
    return { type: "bottom_rank", memberName, playerName: "", detail: "" }
  }
  // Comeback: jumped up 3+ spots
  if (prevRank && prevRank - leagueRank >= 3) {
    return { type: "comeback", memberName, playerName: "", detail: `${prevRank} → ${leagueRank}` }
  }
  // General roast: randomly trigger for mid-table users (~30% chance)
  if (leagueRank > 1 && leagueRank < leagueSize && Math.random() < 0.3) {
    return { type: "general_roast", memberName, playerName: "", detail: "" }
  }
  return null
}

/**
 * Detect auto-pick banter when a user who auto-picked beats manual pickers.
 */
export function detectAutoPickBanter(
  memberName: string,
  isAutoPick: boolean,
  leagueRank: number,
  leagueSize: number,
): BanterEvent | null {
  if (isAutoPick && leagueRank <= Math.ceil(leagueSize / 2)) {
    return { type: "auto_pick_shame", memberName, playerName: "", detail: "" }
  }
  return null
}

/**
 * Format a rich post-match memo for WhatsApp sharing.
 */
export type MemoHighlights = {
  topScorer?: { name: string; runs: number; balls: number; pts: number }
  bestBowler?: { name: string; wickets: number; runs: number; overs: number; pts: number }
  bestFielder?: { name: string; catches: number }
  highestFantasy?: { name: string; pts: number }
  bestCaptainPick?: { playerName: string; ownerName: string; basePts: number; effectivePts: number }
  differentialPick?: { playerName: string; pickedBy: number; pts: number }
}

export function formatMatchMemo(
  matchNumber: number,
  homeTeam: string,
  awayTeam: string,
  resultSummary: string | null,
  rankedUsers: Array<{ name: string; points: number; captainName: string | null }>,
  banterMessages: string[],
  highlights?: MemoHighlights,
): string {
  const medals = ["🥇", "🥈", "🥉"]
  const lines: string[] = []

  lines.push(`🏏 *TIPL MATCH #${matchNumber} MEMO*`)
  lines.push(`${homeTeam} vs ${awayTeam}`)
  if (resultSummary) lines.push(`_${resultSummary}_`)
  lines.push("")

  // Fantasy standings
  lines.push("━━━ 🏆 *FANTASY STANDINGS* ━━━")
  for (let i = 0; i < rankedUsers.length; i++) {
    const u = rankedUsers[i]
    const medal = medals[i] ?? ` ${i + 1}.`
    const captainInfo = u.captainName ? ` (C: ${u.captainName})` : ""
    lines.push(`${medal} ${u.name} — *${u.points}* pts${captainInfo}`)
  }
  lines.push("")

  // Match highlights
  if (highlights) {
    lines.push("━━━ ⚡ *MATCH HIGHLIGHTS* ━━━")
    if (highlights.topScorer) {
      const s = highlights.topScorer
      lines.push(`🏏 Top Scorer: *${s.name}* — ${s.runs}(${s.balls}) · ${s.pts} pts`)
    }
    if (highlights.bestBowler) {
      const b = highlights.bestBowler
      lines.push(`🎯 Best Bowler: *${b.name}* — ${b.wickets}/${b.runs} (${b.overs} ov) · ${b.pts} pts`)
    }
    if (highlights.bestFielder && highlights.bestFielder.catches >= 2) {
      lines.push(`🧤 Best Fielder: *${highlights.bestFielder.name}* — ${highlights.bestFielder.catches} catches`)
    }
    if (highlights.highestFantasy) {
      lines.push(`🔥 Highest Fantasy: *${highlights.highestFantasy.name}* — ${highlights.highestFantasy.pts} pts`)
    }
    lines.push("")
  }

  // Fantasy insights
  if (highlights && (highlights.bestCaptainPick || highlights.differentialPick)) {
    lines.push("━━━ 📈 *FANTASY INSIGHTS* ━━━")
    if (highlights.bestCaptainPick) {
      const c = highlights.bestCaptainPick
      lines.push(`👑 Best Captain: *${c.playerName}* (${c.ownerName}) — ${c.basePts} × 2 = ${c.effectivePts} pts`)
    }
    if (highlights.differentialPick) {
      const d = highlights.differentialPick
      lines.push(`💡 Differential: *${d.playerName}* — picked by ${d.pickedBy}, scored ${d.pts} pts`)
    }
    if (rankedUsers.length > 0) {
      const last = rankedUsers[rankedUsers.length - 1]
      lines.push(`📉 Wooden Spoon: ${last.name} (${last.points} pts)`)
    }
    lines.push("")
  }

  // Banter — shuffle and pick up to 6 for variety
  if (banterMessages.length > 0) {
    lines.push("━━━ 🎭 *BANTER* ━━━")
    const shuffled = [...banterMessages].sort(() => Math.random() - 0.5)
    for (const msg of shuffled.slice(0, 6)) {
      lines.push(`• ${msg}`)
    }
    lines.push("")
  }

  lines.push("_Generated by TIPL Fantasy 2026_")
  return lines.join("\n")
}
