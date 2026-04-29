# Homepage Redesign — Design Spec

**Date:** 2026-04-29  
**Status:** Approved for implementation

---

## Context

The current homepage (`src/app/(app)/dashboard/page.tsx`) is designed like a marketing landing page for a returning-user utility app. A 70vh cinematic hero, static stat grid, and buried standings table do not match how users actually use the app — daily, to answer two questions: *"Have I picked yet?"* and *"Where do I rank?"*

This redesign keeps the cinematic match hero (elevated and premium) but restructures the entire page hierarchy around those two questions. Inspired by Revolut (massive number hierarchy, activity-feed thinking), F1 (championship standings as the hero data), and Sorare (player photography, squad ownership feeling).

---

## Design Principles

1. **Task-first, status-second** — the dominant above-fold element answers "what do I need to do?" The rest of the scroll answers "how am I doing?"
2. **One giant number** — your rank in 52px type is the "account balance." Everything else is supporting.
3. **State-aware hero** — the page looks and feels different depending on whether you've picked, match is live, or scores are in.
4. **Single accent, used with restraint** — orange (#ff6b00) means action or "you." Gold means points/winner. Everything else is near-white or muted.
5. **No glass morphism noise** — flat surfaces, thin 1px borders, elevation reserved for the hero.
6. **Both themes** — dark (default) and warm light. Hero stays cinematic in both. Content area adapts.

---

## Page Structure

```
┌─────────────────────────────────┐
│  STATUS BAR                     │
├─────────────────────────────────┤
│                                 │
│  CINEMATIC HERO  (~296px)       │
│  • Team color territory split   │
│  • Captain + #2 player photos   │
│  • Match identity (VS, crests)  │
│  • Countdown                    │
│  • STATE CTA (bottom)           │
│                                 │
├─────────────────────────────────┤
│  YOUR SEASON                    │
│  • #4 rank (52px) + delta pill  │
│  • 847 pts (gold)               │
│  • Avg / gap-to-lead pills      │
│  • On the Bubble (target/threat)│
│  • Match Win Cabinet            │
├─────────────────────────────────┤
│  CHAMPIONSHIP STANDINGS         │
│  • F1 timing grid (6 rows + you)│
├─────────────────────────────────┤
│  UPCOMING MATCHES               │
│  • 5-card horizontal carousel   │
│  • Pick status per card         │
├─────────────────────────────────┤
│  LAST 3 MATCH RESULTS           │
│  • Per-match expandable card    │
│  • Winner + your result         │
│  • Captain contribution         │
│  • You vs league avg            │
│  • H2H spotlight                │
│  • Top 3 performers             │
├─────────────────────────────────┤
│  MATCH AWARDS (last match)      │
│  • 5 award rows, you highlighted│
├─────────────────────────────────┤
│  BOTTOM NAV                     │
└─────────────────────────────────┘
```

---

## Section Specs

### 1. Cinematic Hero

**Dimensions:** 296px height (down from 70vh / ~560px). No vertical scroll within hero.

**Layers (bottom to top):**
1. `#050507` base (dark) / `#ede9e2` (light)
2. Team color territories — geometric hard split at 108°: home color `0–40%`, near-black seam `40–60%`, away color `60–100%`. Opacity 0.62. No gradient pan animation.
3. Player photography layer (see below)
4. Edge-only vignette: radial gradient from transparent at center to `rgba(0,0,0,0.85)` at bottom + thin top fade
5. Match identity content (centered, z-index above vignette)
6. State CTA strip pinned to hero bottom

**Player photography:**
- Fetch top 2 players per team from `players` table, ordered by `credit_cost DESC`, with `image_url`. If the team's designated captain has lower credit than #1 by cost, still prefer the captain in the primary slot (check `players.is_captain` or equivalent field; if no such field exists, credit order is fine)
- Captain (pos 1): 84px circle, 2.5px team-color ring with glow, gold © crown badge (19px circle, top-right)
- Second player (pos 2): 62px circle, same ring style, 0.85 opacity, positioned slightly behind and above captain
- Home team: players sit in the left third; away team: right third
- Player name (9px, bold) + role label (8px, muted) shown below captain circle only
- **Fallback:** when `image_url` is null → initials in team-color gradient circle, same dimensions

**Match identity (center):**
- Eyebrow: `IPL 2026 · Match {N} · {venue}` — 9px, 4px letter-spacing, gold-tinted
- Team crest (44px rounded square) + team name (16px, 900 weight) + city (9px, muted, all-caps) — left/right aligned to their halves
- VS separator: vertical line | VS text | vertical line, centered 34px column

**Bottom info strip** (positioned above CTA, absolute):
- Left: venue name — 10px, muted
- Right: countdown `⏱ 6h 12m to lock` — 11px, gold, bold

**State CTA strip** (pinned to hero bottom, gradient fade into content):

| State | Treatment |
|---|---|
| Picks open, not picked | Solid orange pill, full-width. "Pick Your XI" 15px 800w + match sub-line. Arrow →. `box-shadow: 0 4px 22px rgba(255,107,0,0.38)` |
| Picks open, already picked | Frosted pill (5% white bg, 1px border). ✓ icon + "Squad Locked — {Captain} © · {VC} VC" + "Edit" ghost button |
| Match live | Red gradient pill. "LIVE · {your score} pts" with pulsing dot |
| Scores published (< 24h) | Neutral pill showing your result: "#6 · 78 pts · ↑2 places" |
| No upcoming match | No CTA strip. Hero shows last match teams, muted |

**Light mode hero:** warm cream (#ede9e2) base, team colors at 10% opacity wash, seam at rgba(230,226,218,0.55). All text switches to dark. CTA gradient fades into light content below.

---

### 2. Your Season

```
[Season Rank label — 9px, spaced, muted]
[#4    of 28]  ← 52px orange / 16px muted    [↑ 2 this round pill]
                                               [847 — 26px gold]
                                               [POINTS — 9px muted]
[62.3 avg / match]  [−177 to lead]  ← pills
```

**Rank number:** `font-size: 52px`, `font-weight: 900`, `letter-spacing: -3px`, color: `--color-primary` (orange). "of 28" at 16px, 0.42 opacity.

**Delta pill:** `↑ 2 this round` — green background tint, green text, 11px bold. Red variant for drops. Hidden if no change.

**Points:** 26px, 800w, gold (`rgba(255,200,80,0.92)`).

**Pills row:** avg/match + gap-to-leader. Flat bg (4% white), 1px border (6% white), 100px border-radius, 11px text. No streak pill.

#### On the Bubble

Two compact rows directly below pills:

```
[TARGET]  Arjun M. — #3 above you   −84 pts to catch   →
[THREAT]  Sneha T. — #5 below you   26 pts behind       ↑ closing
```

- TARGET row: subtle green tint bg + border
- THREAT row: subtle red tint bg + border
- Each row: avatar initials (26px rounded square) + name + gap label
- "Closing" qualifier shown when gap narrowed vs previous match

#### Match Win Cabinet

```
[Your match wins]
🏆 M21   🏆 M28   🏆 M31   [- -]   [- -]
[3 wins · #2 all-time wins ranking]
```

- Gold-tinted chip per win, dashed placeholder chips for future wins
- Shows up to 8 chips (overflow → "+N more")
- Sub-label: win count + all-time win-rank in the league

---

### 3. Championship Standings

Section header: `CHAMPIONSHIP STANDINGS` — 9px, 3px letter-spacing.

**Grid columns:** `22px 1fr 50px 46px` → POS | PLAYER | PTS | GAP

**Always shows:** rows 1–6 (all league members in top-6 positions) + your row if outside top 6 (with `···` separator).

**Row treatments:**
- Position 1: gold-tinted position number
- Your row: orange left border (2px), subtle orange bg tint, orange position number, bold white name, green gap (↑N) or red gap (−N)
- All other rows: muted position, 0.68 opacity name, gold pts, red gap

**"View full table ›"** — tap navigates to `/leaderboard`

---

### 4. Upcoming Matches Carousel

Section header: `UPCOMING MATCHES`

**Carousel:** horizontal snap scroll (`scroll-snap-type: x mandatory`), gap 8px, no scrollbar. Shows 5 cards, first card partially peeks into second.

**Each card (155px wide, ~110px tall):**
```
[M34]                    [OPEN badge]
[MI crest]  VS  [RCB crest]
[Mumbai]        [Royal CB]
[Today · 7:30 PM]
[Pick XI →]  or  [✓ Picked]  or  [Not picked]
```

**Status badges:**
- `OPEN` — orange tint + border
- `LOCKED` — muted gray
- `LIVE` — red tint, pulsing opacity animation

**Pick status line (bottom of card):**
- Not picked + open → "Pick XI →" in orange
- Picked → "✓ Picked" in green
- Not picked + locked → "Not picked" in muted orange (warning)

**Post-lock:** Pick Consensus appears as a tooltip/overlay on tap — "67% picked Rohit as captain."

---

### 5. Last 3 Match Results

Section header: `LAST 3 MATCH RESULTS`

**Each match result card:**

```
┌─ KKR vs LSG · Match 33 ────── Yesterday ─┐
│  🥇  Arjun M.                   124 pts  │  ← winner
│  #6  You · Rohit © · Bumrah VC   78 pts ↑2│  ← your result
├───────────────────────────────────────────┤
│  Captain: Rohit © · 58 × 2 = 116 pts ✓  │  ← captain scorecard
├───────────────────────────────────────────┤
│  You  ████████░░  78                     │  ← you vs avg
│  Avg  ██████░░░░  65   +13 above avg     │
│  Best ██████████ 124                     │
├───────────────────────────────────────────┤
│  You 78  VS  Arjun M. 124   rival beat you│  ← H2H spotlight
├───────────────────────────────────────────┤
│  Top performers                           │
│  1  Rohit S. · BAT · MI       72 pts     │
│  2  Virat K. · BAT · RCB      58 pts     │
│  3  Bumrah J. · BOWL · MI     54 pts     │
└───────────────────────────────────────────┘
```

**Captain Scorecard:** shown for your pick. Format: `{Player} © · {base}pts × 2 = {total}pts`. Verdict: ✓ Good pick (if in top-3 captains), ✗ Better options existed (if captain scored < league avg captain).

**You vs Avg:** three horizontal bars (you / league avg / match best). Delta label: "+13 above avg" in green or "−8 below avg" in red.

**H2H Spotlight:** your score vs the On the Bubble TARGET player's score that match. Single row, no clutter. **Edge case:** if user is rank #1 (no TARGET above them), show H2H vs the THREAT (rank #2) instead.

**Top Performers:** top 3 individual player point-scorers that match. Avatar initials + name + role + team + pts.

---

### 6. Match Awards

Section header: `MATCH {N} AWARDS` with match sub-label (e.g. "KKR vs LSG · Yesterday").

**Five award rows** in a bordered rounded card:

| Award | Icon | Color | Definition |
|---|---|---|---|
| Match Winner | 🏆 | Gold | Highest total fantasy score |
| Best Captain Pick | © | Orange | Highest captain-multiplied pts (`base × 2`) |
| Best VC Pick | 🎖 | Purple | Highest VC-multiplied pts (`base × 1.5`) |
| Biggest Mover | ↑ | Green | Most rank positions gained this match |
| Hidden Gem | 💎 | Blue | Highest-scoring player with credit cost in the bottom 30% of the credit range (threshold derived at runtime from `MIN`/`MAX` credit in DB, not hardcoded) |

**When you won an award:**
- Row gets orange left border + orange bg tint
- Winner name shows as "You 🎉" in orange
- "You won" pill (orange, right side)

**When you didn't win:** muted winner name, no tint.

This section shows for the most recently completed match only. Tapping navigates to full match scorecard (`/match/{id}/scores`).

---

## Data Requirements

All data currently fetched in `src/app/(app)/dashboard/page.tsx`. New queries needed:

| Feature | Query | Notes |
|---|---|---|
| Player photos | Already fetched (`players` by `credit_cost DESC`, `image_url`) | Confirm captain is included |
| On the Bubble | `season_leaderboard` rows at rank ± 1 | Already fetched (top 6), extend to include user's neighbours |
| Match Win Cabinet | `user_match_scores` where `rank = 1` for user | New query |
| You vs League Avg | `AVG(score)`, `MAX(score)` per match | Aggregate on `user_match_scores` |
| Captain Scorecard | `selections` (captain_id) + player score for that match | Cross-reference `match_player_scores` |
| H2H Spotlight | Bubble target's score for same match | Join with `user_match_scores` for target player |
| Top Performers | Top 3 `match_player_scores` by pts for last 3 matches | New query — verify table exists; if individual player match scores are not persisted separately, this may require a new migration |
| Match Awards | All 5 computations on `user_match_scores` + `selections` | Best computed server-side |
| Pick Consensus | `COUNT(captain_id)` grouped per match | New aggregate — reveal post-lock only |

**Fetch strategy:** extend existing two-phase parallel pattern. Phase 1 adds win cabinet + league neighbour queries. Phase 2 adds match-level stats once match IDs are known.

---

## Component Changes

| Component | Action | Notes |
|---|---|---|
| `cinematic-hero.tsx` | Rewrite | Reduce height, remove film grain + gradient-pan animation, add player photo medallions, state-aware CTA strip |
| `form-strip.tsx` | Delete | Replaced by rank block |
| `recent-match-recap.tsx` | Delete | Content absorbed into Last 3 Match Results |
| `standings-table.tsx` | Refactor props/display only | New F1 grid columns, 6-row default. On the Bubble rows live in the parent section, not this component. Component is shared with leaderboard page — only change dashboard-specific props, do not break leaderboard usage |
| `podium-card.tsx` | Remove from dashboard | Keep component for leaderboard page |
| New: `rank-block.tsx` | Create | Rank number, delta pill, pts, pills row |
| New: `on-the-bubble.tsx` | Create | Target + threat rows |
| New: `match-win-cabinet.tsx` | Create | Trophy chips |
| New: `upcoming-carousel.tsx` | Create | 5-card snap carousel |
| New: `match-result-card.tsx` | Create | Expandable card with all inline features |
| New: `match-awards.tsx` | Create | 5 award rows, highlight-you logic |

---

## Theme

**Dark (default):**
- Base: `#050507`
- Content bg: `#050507`
- Borders: `rgba(255,255,255,0.05–0.08)`
- Hero: team colors at 0.62 opacity on true-black base

**Light:**
- Base: `#f5f3ef` (warm cream)
- Hero: `#ede9e2`, team colors at 0.10 opacity
- Hero acts as a cinematic dark-card embedded in the light page
- Accent orange darkens to `#d95200`, gold to `#b45309`

Both themes share the existing CSS custom property system in `globals.css`. No new tokens needed — all hero dark treatment uses hardcoded values scoped to the hero element.

---

## What's Removed from Current Dashboard

- `CinematicHero` — replaced (same concept, new implementation)
- `FormStrip` — deleted
- `RecentMatchRecap` — content absorbed
- Horizontal match carousel (current) — replaced with new `UpcomingCarousel`
- `PodiumCard` — removed from homepage (lives on leaderboard page)
- 70vh hero height constraint

---

## Verification

1. **Dark + light hero:** confirm hero renders at ~296px in both themes, player photo medallions visible, CTA state changes on pick submission
2. **State machine:** test all 5 CTA states (unpicked / picked / live / post-match / no match)
3. **Standings:** confirm 6 rows always visible, your row highlights correctly when outside top 6
4. **Carousel:** snap scroll works on mobile, OPEN badge shows only for unlocked matches, pick consensus appears post-lock
5. **Match result cards:** captain scorecard shows correct `base × 2` math, you vs avg bars scale correctly, H2H uses on-the-bubble target
6. **Awards:** verify each award definition computes correctly (especially Best Captain = captain contribution, not total score), your-award highlight fires correctly
7. **Performance:** page load with new queries stays under 500ms — use existing Phase 1/Phase 2 parallel pattern
8. **Fallbacks:** test with missing `image_url` (initials fallback), no completed matches (empty state for Last 3 + Awards), new user with no scores (rank block shows "--")
