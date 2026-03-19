# TIPL — Architecture Document

> Office IPL 2026 Fantasy Cricket
> Last updated: 2026-03-17

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Directory Structure](#4-directory-structure)
5. [Database Schema](#5-database-schema)
6. [Authentication & Middleware](#6-authentication--middleware)
7. [Row Level Security (RLS)](#7-row-level-security-rls)
8. [Server Actions](#8-server-actions)
9. [Scoring Engine](#9-scoring-engine)
10. [Team Selection & Validation](#10-team-selection--validation)
11. [PWA & Mobile](#11-pwa--mobile)
12. [Auto-Pick System](#12-auto-pick-system)
13. [Admin Panel](#13-admin-panel)
14. [Leagues System](#14-leagues-system)
15. [Known Gaps & Roadmap](#15-known-gaps--roadmap)
16. [Environment Variables](#16-environment-variables)

---

## 1. Overview

TIPL is a fantasy cricket web app for an office IPL 2026 league (up to 100 users). Users pick 11 players per match from the combined Playing XI (22 players), earn fantasy points post-match, and compete on season and league leaderboards.

Key constraints:
- NOT a Dream11 clone — simple, fun, no real money
- Must launch before March 28, 2026
- Mobile-first PWA (installable, add-to-home-screen)
- Dark theme by default with light mode toggle
- Budget: free-tier hosting (Vercel + Supabase)

---

## 2. Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | Next.js (App Router) | 16.1.6 | Turbopack for dev |
| Language | TypeScript | ^5 | Strict mode |
| UI | Tailwind CSS + shadcn/ui | v4 / latest | Dark theme, mobile-first |
| Component lib | Radix UI | various | Via shadcn/ui primitives |
| Backend / DB | Supabase | — | PostgreSQL + Auth + Edge Functions |
| Auth | Supabase Auth | — | Google OAuth (PKCE flow) |
| Hosting | Vercel | Free tier | Auto-deploy from main |
| Cricket data | CricketData.org | — | `api.cricapi.com` primary |
| State | React state + server actions | — | No Redux/Zustand/TRPC |
| Toasts | Sonner | ^2.0.3 | Toast notifications |
| Drawer | Vaul | ^1.1.2 | Bottom sheet pattern |
| Date utils | date-fns | ^4.1.0 | Lightweight date formatting |
| Icons | Lucide React | ^0.474.0 | Tree-shakeable icon set |
| Themes | next-themes | ^0.4.6 | Dark/light mode |
| Validation | Zod | ^3.24.2 | Form/data validation |
| PWA | Custom service worker | — | Manual approach; next-pwa incompatible with Turbopack |

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│                  Vercel (Edge)                   │
│  ┌───────────────────────────────────────────┐  │
│  │           Next.js App Router              │  │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────┐  │  │
│  │  │ Server  │  │  Server  │  │ Client  │  │  │
│  │  │Components│  │ Actions  │  │Components│  │  │
│  │  └────┬────┘  └────┬─────┘  └────┬────┘  │  │
│  │       │            │              │       │  │
│  │       └────────────┼──────────────┘       │  │
│  │                    │                      │  │
│  │             Middleware (auth)              │  │
│  └────────────────────┼─────────────────────┘  │
│                       │                         │
└───────────────────────┼─────────────────────────┘
                        │ HTTPS
┌───────────────────────┼─────────────────────────┐
│              Supabase (Cloud)                    │
│  ┌────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Auth  │  │ Postgres │  │ Edge Functions │  │
│  │(Google)│  │  + RLS   │  │  (auto-pick,   │  │
│  └────────┘  └──────────┘  │  sync-stats)   │  │
│                             └────────────────┘  │
│  ┌──────────────────────────────────────────┐   │
│  │  pg_cron (auto-lock matches every 5 min) │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
                        │
┌───────────────────────┼─────────────────────────┐
│          CricketData.org API                     │
│  (Match data, player stats, Playing XI)          │
└─────────────────────────────────────────────────┘
```

---

## 4. Directory Structure

```
tipl/
├── public/
│   ├── favicon.ico                          ✅ Built
│   ├── manifest.json                        ✅ Built
│   ├── sw.js                                ✅ Built — custom service worker
│   └── icons/
│       ├── icon-192.png                     ✅ Built
│       └── icon-512.png                     ✅ Built
├── src/
│   ├── middleware.ts                         ✅ Built — auth guard, PKCE redirect
│   ├── app/
│   │   ├── layout.tsx                       ✅ Built — root layout, PWA meta, theme
│   │   ├── page.tsx                         ✅ Built — root redirect
│   │   ├── globals.css                      ✅ Built — Tailwind v4, custom properties
│   │   ├── auth/
│   │   │   └── callback/route.ts            ✅ Built — PKCE code exchange
│   │   ├── login/
│   │   │   ├── layout.tsx                   ✅ Built
│   │   │   └── page.tsx                     ✅ Built — Google OAuth login
│   │   └── (app)/                           ✅ Route group — authenticated shell
│   │       ├── layout.tsx                   ✅ Built — nav bar, ambient gradient
│   │       ├── error.tsx                    ✅ Built
│   │       ├── loading.tsx                  ✅ Built
│   │       ├── dashboard/
│   │       │   ├── page.tsx                 ✅ Built — season rank, next match, leaderboard
│   │       │   ├── error.tsx                ✅ Built
│   │       │   └── loading.tsx              ✅ Built
│   │       ├── matches/
│   │       │   ├── page.tsx                 ✅ Built — filterable match list
│   │       │   ├── match-list.tsx           ✅ Built — client-side match filtering
│   │       │   ├── error.tsx                ✅ Built
│   │       │   └── loading.tsx              ✅ Built
│   │       ├── match/[id]/
│   │       │   ├── pick/
│   │       │   │   ├── page.tsx             ✅ Built — team selection page
│   │       │   │   ├── pick-team-client.tsx ✅ Built — interactive pick UI
│   │       │   │   ├── error.tsx            ✅ Built
│   │       │   │   └── loading.tsx          ✅ Built
│   │       │   └── scores/
│   │       │       ├── page.tsx             ✅ Built — post-match points breakdown
│   │       │       ├── error.tsx            ✅ Built
│   │       │       └── loading.tsx          ✅ Built
│   │       ├── leaderboard/
│   │       │   ├── page.tsx                 ✅ Built — season/match tabs, league filter
│   │       │   ├── leaderboard-selector.tsx ✅ Built — client tab/filter UI
│   │       │   ├── error.tsx                ✅ Built
│   │       │   └── loading.tsx              ✅ Built
│   │       ├── leagues/
│   │       │   ├── page.tsx                 ✅ Built — league list, create/join
│   │       │   ├── leagues-client.tsx       ✅ Built — league management UI
│   │       │   ├── error.tsx                ✅ Built
│   │       │   ├── loading.tsx              ✅ Built
│   │       │   └── [id]/
│   │       │       ├── page.tsx             ✅ Built — league detail
│   │       │       ├── league-detail-client.tsx ✅ Built — league leaderboard UI
│   │       │       ├── error.tsx            ✅ Built
│   │       │       ├── loading.tsx          ✅ Built
│   │       │       └── h2h/
│   │       │           ├── page.tsx         ✅ Built — head-to-head comparison
│   │       │           ├── h2h-client.tsx   ✅ Built — H2H client UI
│   │       │           ├── error.tsx        ✅ Built
│   │       │           └── loading.tsx      ✅ Built
│   │       ├── profile/
│   │       │   ├── page.tsx                 ✅ Built — stats, sparkline, match history
│   │       │   ├── name-form.tsx            ✅ Built — display name editor
│   │       │   ├── sign-out-button.tsx      ✅ Built
│   │       │   ├── theme-card.tsx           ✅ Built — theme preference card
│   │       │   ├── error.tsx                ✅ Built
│   │       │   └── loading.tsx              ✅ Built
│   │       └── admin/
│   │           ├── page.tsx                 ✅ Built — admin dashboard
│   │           ├── error.tsx                ✅ Built
│   │           ├── loading.tsx              ✅ Built
│   │           ├── match/[id]/
│   │           │   ├── page.tsx             ✅ Built — match management
│   │           │   ├── client.tsx           ✅ Built — scorecard entry, Playing XI, status
│   │           │   ├── error.tsx            ✅ Built
│   │           │   └── loading.tsx          ✅ Built
│   │           └── players/
│   │               ├── page.tsx             ✅ Built — player management
│   │               ├── players-client.tsx   ✅ Built — player CRUD UI
│   │               ├── error.tsx            ✅ Built
│   │               └── loading.tsx          ✅ Built
│   ├── components/
│   │   ├── ambient-gradient.tsx             ✅ Built — background gradient orbs
│   │   ├── cricket-field.tsx                ✅ Built — cricket field visualization
│   │   ├── install-prompt.tsx               ✅ Built — PWA install banner + iOS instructions
│   │   ├── nav-bar.tsx                      ✅ Built — bottom navigation bar
│   │   ├── page-error.tsx                   ✅ Built — reusable error boundary component
│   │   ├── page-loading.tsx                 ✅ Built — reusable loading skeleton
│   │   ├── player-stats-drawer.tsx          ✅ Built — player statistics drawer
│   │   ├── segmented-progress-bar.tsx       ✅ Built — progress indicator
│   │   ├── sw-register.tsx                  ✅ Built — service worker registration
│   │   ├── theme-provider.tsx               ✅ Built — theme context (next-themes)
│   │   ├── theme-toggle.tsx                 ✅ Built — dark/light toggle
│   │   └── ui/                              shadcn/ui primitives
│   │       ├── avatar.tsx                   ✅ Built
│   │       ├── badge.tsx                    ✅ Built
│   │       ├── button.tsx                   ✅ Built
│   │       ├── card.tsx                     ✅ Built
│   │       ├── dialog.tsx                   ✅ Built
│   │       ├── drawer.tsx                   ✅ Built
│   │       ├── dropdown-menu.tsx            ✅ Built
│   │       ├── input.tsx                    ✅ Built
│   │       ├── label.tsx                    ✅ Built
│   │       ├── separator.tsx                ✅ Built
│   │       ├── sheet.tsx                    ✅ Built
│   │       ├── skeleton.tsx                 ✅ Built
│   │       ├── sonner.tsx                   ⚠️ MISSING — Sonner toast wrapper (needed for toast UI)
│   │       ├── table.tsx                    ✅ Built
│   │       └── tabs.tsx                     ✅ Built
│   ├── actions/
│   │   ├── leagues.ts                       ✅ Built — league create/join/leave
│   │   ├── matches.ts                       ✅ Built — match status, Playing XI
│   │   ├── players.ts                       ✅ Built — player CRUD
│   │   ├── profile.ts                       ✅ Built — profile updates
│   │   ├── scoring.ts                       ✅ Built — calculate & publish scores
│   │   └── selections.ts                    ✅ Built — save/update team picks
│   ├── lib/
│   │   ├── api/
│   │   │   └── cricapi.ts                   ✅ Built — CricketData.org wrapper
│   │   ├── supabase/
│   │   │   ├── client.ts                    ✅ Built — createBrowserClient
│   │   │   ├── server.ts                    ✅ Built — createServerClient
│   │   │   ├── admin.ts                     ✅ Built — service_role client
│   │   │   └── middleware.ts                ✅ Built — session refresh + auth guard
│   │   ├── auto-pick.ts                     ✅ Built — previous-match / popular / random fallback
│   │   ├── avatar.ts                        ✅ Built — avatar generation
│   │   ├── badges.ts                        ✅ Built — badge/achievement logic
│   │   ├── constants.ts                     ✅ Built — app-wide constants (budget, limits)
│   │   ├── scoring.ts                       ✅ Built — fantasy points engine
│   │   ├── types.ts                         ✅ Built — TypeScript types matching DB schema
│   │   ├── utils.ts                         ✅ Built — cn() helper
│   │   ├── validation.ts                    ✅ Built — team composition rules
│   │   └── whatsapp.ts                      ✅ Built — message formatter
│   └── supabase/
│       └── (placeholder for local dev config)
├── supabase/
│   ├── migrations/
│   │   ├── 001_schema.sql                   ✅ Built — full schema
│   │   ├── 002_seed_data.sql                ✅ Built — teams, players, scoring rules
│   │   ├── 008_auto_lock_cron.sql           ✅ Built — pg_cron auto-lock function
│   │   ├── 009_rls_policies.sql             ✅ Built — all RLS policies
│   │   ├── 010_add_credit_cost.sql          ✅ Built — player credit costs
│   │   └── 011_leagues.sql                  ✅ Built — leagues schema + RLS
│   └── functions/
│       ├── auto-pick/                       ✅ Built — edge function for auto-pick
│       └── sync-player-stats/               ✅ Built — edge function for stat sync
├── next.config.ts                           ✅ Configured — Turbopack enabled, manual SW
├── package.json                             ✅ Built
├── tsconfig.json                            ✅ Built
├── tailwind.config.ts                       ✅ Built
└── postcss.config.mjs                       ✅ Built
```

---

## 5. Database Schema

### Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `profiles` | User profiles (linked to `auth.users`) | `id` (FK→auth.users), `display_name`, `avatar_url`, `is_admin` |
| `teams` | IPL teams | `name`, `short_name`, `color`, `logo_url` |
| `players` | All IPL players | `name`, `team_id`, `role` (enum), `credit_cost`, `is_active`, IPL career stats |
| `matches` | Season schedule | `match_number`, `team_home_id`, `team_away_id`, `venue`, `start_time`, `status` (enum) |
| `playing_xi` | Announced lineups per match | `match_id`, `player_id`, `team_id` |
| `selections` | User's team pick per match | `user_id`, `match_id`, `captain_id`, `vice_captain_id`, `is_auto_pick` |
| `selection_players` | Join table: selection ↔ players | `selection_id`, `player_id` |
| `scoring_rules` | Admin-editable point values | `category`, `name`, `label`, `points`, `is_active` |
| `match_player_scores` | Per-player stats + fantasy points per match | All batting/bowling/fielding stats, `fantasy_points`, `breakdown` (JSONB) |
| `user_match_scores` | Per-user total points per match | `total_points`, `rank`, `captain_points`, `vc_points` |
| `admin_logs` | Audit trail for admin actions | `admin_id`, `action`, `entity_type`, `details` |
| `notifications` | User notifications | `title`, `body`, `type`, `is_read` |
| `leagues` | Social leagues / friend groups | `name`, `invite_code`, `creator_id` |
| `league_members` | League membership join table | `league_id`, `user_id` |

### Materialized View

| View | Purpose |
|---|---|
| `season_leaderboard` | Aggregated season standings — refreshed via `refresh_leaderboard()` RPC |

### Enums

| Enum | Values |
|---|---|
| `player_role` | `WK`, `BAT`, `AR`, `BOWL` |
| `match_status` | `upcoming`, `live`, `completed`, `no_result`, `abandoned` |
| `scoring_category` | `batting`, `bowling`, `fielding`, `bonus`, `penalty` |
| `notification_type` | `match_reminder`, `scores_published`, `admin`, `system` |

### Key Functions

| Function | Type | Purpose |
|---|---|---|
| `handle_new_user()` | Trigger | Auto-create profile on auth signup |
| `refresh_leaderboard()` | RPC | Refresh the `season_leaderboard` materialized view |
| `auto_lock_matches()` | Scheduled | Set upcoming matches to `live` when `start_time` passes |
| `get_league_leaderboard(p_league_id)` | RPC | Compute leaderboard for a specific league |

### ER Relationships

```
auth.users ──1:1──▶ profiles
profiles   ──1:N──▶ selections
profiles   ──1:N──▶ user_match_scores
profiles   ──1:N──▶ notifications
profiles   ──1:N──▶ admin_logs
profiles   ──1:N──▶ leagues (as creator)
profiles   ──M:N──▶ leagues (via league_members)
teams      ──1:N──▶ players
teams      ──1:N──▶ matches (home/away)
matches    ──1:N──▶ playing_xi
matches    ──1:N──▶ selections
matches    ──1:N──▶ match_player_scores
matches    ──1:N──▶ user_match_scores
players    ──1:N──▶ playing_xi
players    ──1:N──▶ match_player_scores
selections ──M:N──▶ players (via selection_players)
```

---

## 6. Authentication & Middleware

### Flow

1. User clicks "Sign in with Google" on `/login`
2. Supabase Auth initiates Google OAuth (PKCE flow)
3. Google redirects to Supabase, which redirects to the app's site URL with `?code=xxx`
4. Middleware intercepts the `?code=` param and redirects to `/auth/callback`
5. `/auth/callback/route.ts` exchanges the code for a session
6. User is redirected to `/dashboard`

### Middleware Logic (`src/middleware.ts` → `lib/supabase/middleware.ts`)

1. **PKCE redirect**: If URL has `?code=` and path is not `/auth/*`, redirect to `/auth/callback`
2. **Session refresh**: Call `supabase.auth.getUser()` to refresh the JWT
3. **Auth guard**: Unauthenticated users → redirect to `/login`
4. **Login redirect**: Authenticated users on `/login` → redirect to `/`
5. **Admin guard**: Non-admin users on `/admin/*` → redirect to `/dashboard`

### Matcher

Excludes static files, Next.js internals, `manifest.json`, `sw.js`, and icons from middleware processing.

---

## 7. Row Level Security (RLS)

All tables have RLS enabled. Key policies:

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | All users | Trigger only | Own profile | — |
| `teams` | Authenticated | — | — | — |
| `players` | Authenticated | — | — | — |
| `matches` | Authenticated | — | Admins only | — |
| `playing_xi` | Authenticated | — | — | — |
| `selections` | Own + post-lock all | Own (upcoming only) | Own (upcoming only) | Own (upcoming only) |
| `selection_players` | Via selection policy | Own selection | — | Own selection |
| `scoring_rules` | Authenticated | — | — | — |
| `match_player_scores` | Post-match only | — | — | — |
| `user_match_scores` | Post-match only | — | — | — |
| `admin_logs` | Admins only | Admins only | — | — |
| `notifications` | Own only | — | Own only | — |
| `leagues` | Members only | Authenticated (as creator) | — | Creator only |
| `league_members` | Co-members | Self-join | — | Self-leave |

**Important**: Selections are private before match lock; visible to all after match goes `live`/`completed`/`no_result`. This prevents scouting other users' picks.

---

## 8. Server Actions

All mutations go through Next.js Server Actions (not API routes).

| File | Actions | Notes |
|---|---|---|
| `actions/selections.ts` | `saveSelection`, `deleteSelection` | Validates composition, checks match status, upserts |
| `actions/scoring.ts` | `calculateMatchScores`, `publishScores` | Admin-only, computes fantasy points, updates leaderboard |
| `actions/matches.ts` | `updateMatchStatus`, `savePlayingXI`, `savePlayerScores` | Admin-only match management |
| `actions/players.ts` | `createPlayer`, `updatePlayer`, `togglePlayerActive` | Admin-only player CRUD |
| `actions/leagues.ts` | `createLeague`, `joinLeague`, `leaveLeague` | League management |
| `actions/profile.ts` | `updateDisplayName`, `updateAvatar` | User profile updates |

All server actions use `createServerClient` (from `@supabase/ssr`) to respect RLS. Admin actions additionally verify `is_admin` before proceeding.

---

## 9. Scoring Engine

### Location: `src/lib/scoring.ts`

### Per-Player Scoring

The scoring engine loads rules from the `scoring_rules` table (admin-editable), then applies them to raw player stats:

**Batting**:
- Per run, boundary bonus (4s/6s)
- Milestones: century, half-century, thirty (mutually exclusive — highest wins)
- Duck penalty (0 runs, 1+ balls faced)
- Strike rate bonus/penalty (min 10 balls): SR ≥ 170, 150-170, 70-80, < 70

**Bowling**:
- Per wicket, maiden bonus
- Wicket hauls: 3W, 4W, 5W (cumulative)
- Economy bonus/penalty (min 2 overs): ≤ 5, 5-6, 10-11, > 11

**Fielding**:
- Per catch, stumping, run out
- 3+ catches bonus

### Per-User Scoring

- Sum of all 11 players' fantasy points
- Captain: 2× base points (no bonus if auto-pick)
- Vice-Captain: 1.5× base points (no bonus if auto-pick)
- No Result: flat 15 pts to all users

---

## 10. Team Selection & Validation

### Location: `src/lib/validation.ts`

### Composition Rules

| Constraint | Rule |
|---|---|
| Total players | Exactly 11 |
| Wicket-keepers (WK) | 1-4 |
| Batsmen (BAT) | 3-5 |
| All-rounders (AR) | 1-3 |
| Bowlers (BOWL) | 3-5 |
| Max per IPL team | 7 |
| Budget | Total credit cost ≤ budget limit |
| Captain | Must be in squad |
| Vice-Captain | Must be in squad, different from Captain |

### Lock Mechanism

- Selections lock at `match.start_time`
- Middleware + RLS both enforce the lock
- `pg_cron` runs `auto_lock_matches()` every 5 minutes to flip `upcoming` → `live`
- Users who haven't submitted get auto-picked (edge function)

---

## 11. PWA & Mobile

### PWA Assets

| File | Status | Purpose |
|---|---|---|
| `public/manifest.json` | ✅ Built | App name, icons, theme colour, display mode |
| `public/icons/icon-192.png` | ✅ Exists | Home screen icon |
| `public/icons/icon-512.png` | ✅ Exists | Splash screen icon |
| `public/sw.js` | ✅ Built | Custom service worker (network-first + cache fallback) |
| `components/sw-register.tsx` | ✅ Built | Service worker registration component |
| `components/install-prompt.tsx` | ✅ Built | Android A2HS banner + iOS instructions |
| `next.config.ts` | ✅ Configured | Turbopack enabled (manual SW, no next-pwa — incompatible with Turbopack) |

### Mobile Optimization

- Design mobile-first: start at 390px, scale up
- Minimum tap target: 44×44px
- `dvh` units instead of `vh` for mobile viewport
- Bottom sheet pattern (Vaul drawer) for selection UI
- No hover-only interactions — everything works with touch
- Safe area insets for notched phones
- Standalone display mode (no browser chrome)
- Theme color: `#0b0f1e` (matches dark theme background)

### Service Worker Strategy

- **Network-first** with cache fallback for navigation requests
- Static assets cached on install
- Registered via `sw-register.tsx` component in root layout
- No next-pwa plugin — manual approach required because next-pwa is incompatible with Turbopack

---

## 12. Auto-Pick System

### Location: `src/lib/auto-pick.ts` + `supabase/functions/auto-pick/`

### Strategy (in priority order)

1. **Previous match team**: Copy the user's last selection, filtering to current Playing XI
2. **Popular picks**: Select the most-picked players from other users' selections for this match
3. **Random fallback**: Randomly select from Playing XI respecting composition rules

### Penalties

- Auto-picked teams get **no Captain/Vice-Captain bonus** (all players at 1× multiplier)
- `is_auto_pick` flag is set on the selection for transparency

### Trigger

- Edge function invoked when match transitions to `live`
- Only applies to users who have NOT submitted a selection

---

## 13. Admin Panel

### Routes: `/admin/*`

Protected by middleware (checks `profiles.is_admin`).

### Features

| Page | Functionality |
|---|---|
| `/admin` | Dashboard — list all matches, quick-action buttons |
| `/admin/match/[id]` | Full match management: set Playing XI, enter scorecard, change status, calculate scores |
| `/admin/players` | Player CRUD: add, edit, toggle active, manage credit costs |

### Admin Workflow (per match)

1. **Pre-match**: Announce Playing XI (select 11 per team from player pool)
2. **Match day**: Match auto-locks via `pg_cron` (or manual status change)
3. **Post-match**: Enter full scorecard (runs, wickets, balls, etc. per player)
4. **Publish**: Calculate fantasy points → compute user scores → refresh leaderboard
5. **Audit**: All admin actions logged to `admin_logs` table

---

## 14. Leagues System

### Database: `leagues` + `league_members` tables (migration 011)

### Features

- **Create league**: User creates with a name, gets a unique invite code
- **Join league**: Enter invite code to join
- **Leave league**: Members can leave; creators can delete
- **League leaderboard**: Filtered season standings for league members only
- **H2H comparison**: Head-to-head view comparing two league members across matches

### RLS

- Leagues visible only to members
- Anyone can create; only creator can delete
- Members can see co-members; can only join/leave as themselves

### Server Actions: `actions/leagues.ts`

- `createLeague(name)` — creates league + auto-joins creator
- `joinLeague(inviteCode)` — validates code, adds member
- `leaveLeague(leagueId)` — removes self from league

### Database Function

- `get_league_leaderboard(p_league_id)` — SQL function returning aggregated scores for league members

---

## 15. Known Gaps & Roadmap

### 🟢 Resolved (pre-launch)

| Item | Status |
|---|---|
| `AdminMatchClient` component | ✅ Built — full match management UI with scorecard entry |
| `manifest.json` | ✅ Built — configured with correct theme colors |
| `next.config.ts` | ✅ Configured — Turbopack enabled, manual SW (next-pwa incompatible) |
| Root layout metadata | ✅ Built — PWA meta, Apple touch icons, viewport config |
| Dashboard page | ✅ Built — season rank, next match, last result, leaderboard, leagues |
| Matches page | ✅ Built — filterable match list with submission status |
| Leaderboard page | ✅ Built — season/match tabs, league filtering, medal display |
| Profile page | ✅ Built — stats, performance sparkline, role preferences, match history |
| Scores page | ✅ Built — post-match points breakdown with player stats |
| Error boundaries | ✅ Built — error.tsx for every route segment |
| Loading skeletons | ✅ Built — loading.tsx for every route segment |
| Auto-pick logic | ✅ Built — `lib/auto-pick.ts` with previous-match/popular/random fallback |
| Leagues system | ✅ Built — create/join leagues, league leaderboards, H2H |

### 🟡 Post-launch

| Feature | Notes |
|---|---|
| Player photos | Add `photo_url` to players, populate from CricAPI |
| Push notifications | Match reminders, scores published |
| Animated score reveal | Post-match drama UX |
| View others' teams | After match locks — core social feature |
| `pg_cron` auto-lock | Auto-lock matches at `match_time` without admin action |

### 🔵 Future (SaaS)

| Feature | Notes |
|---|---|
| Multi-season support | Archive previous seasons, carry over users |
| WhatsApp bot | Auto-post leaderboard updates to group |
| Custom scoring rules UI | Let league admins tweak point values |
| Player auction mode | Budget-based player drafting |
| Real-time live scores | WebSocket/Realtime integration during matches |

---

## 16. Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Admin operations (bypasses RLS) |
| `CRICAPI_KEY` | Server only | CricketData.org API key |
| `NEXT_PUBLIC_SITE_URL` | Client | Canonical site URL (for OAuth redirects) |
