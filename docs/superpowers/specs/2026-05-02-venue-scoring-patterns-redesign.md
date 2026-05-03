# Venue Scoring Patterns — Redesign Spec

## Context

The existing Venue Scoring Patterns page truncates stadium names mid-word (e.g. "Maharaja Yadavindra Singh Internati...") because a wide table tries to fit 9 columns including a long text field with no room to breathe. The page also stacks three disconnected tables — venue stats, a role×venue matrix, and match history — requiring the user to scroll and mentally join data across sections. The goal is a layout where all data is visible, legible, and cross-referenced in one view, aiding team selection decisions (who to pick based on where the next match is played).

---

## Layout: List + Detail Panel

```
┌──────────────────────────────────────────────────────────────┐
│  Venue Scoring Patterns                                       │
│  ─────────────────────────────────────────────────────────── │
│  ┌────────────────┐  ┌──────────────────────────────────────┐│
│  │ VENUES · AVG ↓ │  │ Rajiv Gandhi International Stadium   ││
│  │                │  │ Hyderabad · 4 matches                ││
│  │ 1 Hyd   1128 ■ │  │ ┌──────┐┌──────┐┌──────┐┌──────┐   ││
│  │ 2 Mul   1086 ■ │  │ │1128.5││ 668.8││ 387.3││  WK  │   ││
│  │ 3 Jai   1084 ■ │  │ └──────┘└──────┘└──────┘└──────┘   ││
│  │ 4 Lkw   1049 ■ │  │ [===Bat 59%=========Bowl 41%======] ││
│  │ ...            │  │                                      ││
│  │                │  │ ROLE PERFORMANCE                     ││
│  │                │  │ WK  ████████  48.2  +8.1 vs season  ││
│  │                │  │ BAT ██████    38.6  +4.3             ││
│  │                │  │ AR  █████     32.1  −1.2             ││
│  │                │  │ BOWL████      27.4  −3.8             ││
│  │                │  │                                      ││
│  │                │  │ TOP 5 BATSMEN  │  TOP 5 BOWLERS     ││
│  │                │  │ 1. R.Pant 68.4 │  1. P.Cummins 44.7 ││
│  │                │  │ ...            │  ...               ││
│  │                │  │                                      ││
│  │                │  │ MATCH HISTORY AT VENUE               ││
│  │                │  │ M#4  SRH vs DC  1187  Top: Ramesh   ││
│  └────────────────┘  └──────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

The left panel is a fixed-width (280px) scrollable ranked list. The right panel is a scrollable detail view that updates when any venue is clicked. First venue is selected by default.

---

## Files to Modify

### 1. `src/lib/analytics.ts`

**Extend `VenueAnalytics` type** (currently ~line 211):
```typescript
type VenueAnalytics = {
  // existing fields unchanged
  venue: string
  matches: number
  avgTotalFP: number
  avgBattingFP: number
  avgBowlingFP: number
  avgFieldingFP: number
  battingPct: number
  classification: "bat-friendly" | "bowl-friendly" | "balanced"
  bestRole: string
  topPerformer: string
  roleAvg: Record<string, number>
  // NEW
  topBatsmen: VenueTopPlayer[]
  topBowlers: VenueTopPlayer[]
}

type VenueTopPlayer = {
  playerId: string
  name: string
  role: string
  team: string
  avgFP: number
  matches: number
}
```

**Extend `computeVenueAnalytics()`** (currently ~line 979): after the existing `topPerformer` logic, compute top 5 batsmen and top 5 bowlers per venue by filtering `playerMap` by role, averaging FP from `acc.playerFPs`, sorting desc, and slicing to 5.

Batsmen = roles WK + BAT. Bowlers = roles BOWL + AR (sorted by bowling FP contribution, i.e. `avgBowlingFP` from breakdown if available, else total FP).

**Add `globalRoleAvg` computation**: a flat pass over all player scores before the per-venue grouping loop, to get season-wide avg FP per role (WK/BAT/AR/BOWL). Return it alongside `venueData` so the detail panel can show "vs season avg" deltas.

### 2. `src/app/(app)/admin/analytics/page.tsx`

No query changes needed — all required data (`match_player_scores`, `players`) is already fetched. Pass `globalRoleAvg` (new computed value from analytics.ts) as a prop to `AnalyticsClient`.

### 3. `src/app/(app)/admin/analytics/analytics-client.tsx`

**Replace the entire `VenuesSection`** component (currently lines 1373–1525) with the new two-panel layout.

#### Left panel — `VenueListPanel`
- Fixed 280px width, full height, `overflow-y: auto`
- Header: "VENUES · SORTED BY AVG FP ↓"
- Each row: rank number, abbreviated venue name + city, avg FP, mini 5px split bar (orange/blue), match count
- Active row has orange left border + subtle background
- Click sets `selectedVenueIndex` state (default 0)
- Venue name abbreviation: regex-strip known long tokens (`/\b(International|Stadium|Cricket Ground|Ekana|Bharat Ratna Shri Atal Bihari Vajpayee)\b/g`) then trim; extract the city from the venue string (last comma-delimited token) and show it as a second line label. This avoids a hardcoded map while keeping the list readable.

#### Right panel — `VenueDetailPanel`
Receives `venue: VenueAnalytics`, `matchRows: MatchScoringRow[]`, `globalRoleAvg: Record<string, number>` as props.

Four sections rendered top-to-bottom, panel is `overflow-y: auto`:

**Section 1 — Header card**
- Full venue name (no truncation), classification badge (BAT/BOWL/BAL)
- City + match count subtitle
- 4 stat boxes: Avg Total FP, Avg Bat FP, Avg Bowl FP, Best Role
- Full-width orange/blue split bar with percentage labels and legend

**Section 2 — Role Performance**
- Two-column: left = 4 horizontal bars (WK/BAT/AR/BOWL) with avg FP and delta vs `globalRoleAvg`; right = "vs season avg" comparison box showing season baseline per role and a headline insight (e.g. "WK scores +20% above season avg here")
- Bar colour: orange if above season avg, blue if below

**Section 3 — Top 5 Batsmen + Top 5 Bowlers** (side-by-side grid)
- Each: rank (medal for 1-3), player name, team + role subtitle, avg FP, matches played
- "Batsmen" = WK + BAT roles combined, sorted by total avg FP desc; "Bowlers" = BOWL + AR roles combined, sorted by total avg FP desc

**Section 4 — Match History**
- Filtered from `matchScoringRows` where `row.venue === venue.venue`
- Columns: Match #, Teams, Total FP, Avg User Score, Top User (name + score), Best Player (name + FP)
- Sorted by match number descending (most recent first)

#### State
```typescript
const [selectedVenueIndex, setSelectedVenueIndex] = useState(0)
const selectedVenue = venueData[selectedVenueIndex]
const venueMatches = matchScoringRows.filter(r => r.venue === selectedVenue.venue)
```

---

## Data Flow

```
page.tsx
  └─ computeVenueAnalytics(matchPlayerScores, players, teams)
       └─ returns VenueAnalytics[] (now includes topBatsmen, topBowlers)
  └─ computeGlobalRoleAvg(matchPlayerScores, players)   ← NEW helper
       └─ returns Record<"WK"|"BAT"|"AR"|"BOWL", number>
  └─ computeMatchScoringRows(...)                        ← unchanged
  └─ passes all three to AnalyticsClient as props

AnalyticsClient
  └─ VenuesSection receives venueData, matchScoringRows, globalRoleAvg
       └─ VenueListPanel (left) — click → setSelectedVenueIndex
       └─ VenueDetailPanel (right) — renders selected venue's 5 sections
```

---

## Verification

1. Run `npm run dev`, navigate to `/admin/analytics`, click the Venues tab
2. All venue names visible without truncation in both left list (abbreviated) and right panel (full)
3. Clicking each venue in the list updates the right panel — all 5 sections reflect that venue's data
4. Role bars show correct delta vs season avg (manually cross-check one venue against raw data)
5. Top 5 batsmen list is sorted by avg FP descending, contains only WK + BAT roles
6. Top 5 bowlers list is sorted by avg FP descending, contains only BOWL + AR roles
7. Match history shows only matches played at selected venue, sorted most-recent-first
8. `npm run build` passes with no TypeScript errors
