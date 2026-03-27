# TIPL — Office IPL 2026 Fantasy Cricket

## Project Overview
Fantasy cricket web app for an office IPL 2026 league (up to 100 users).
Users pick 11 players per match, earn fantasy points post-match.
NOT a Dream11 clone — simple, fun, no real money.
Must launch before March 28, 2026.

## Tech Stack (Non-negotiable)
- Framework: Next.js 14+ (App Router), TypeScript, strict mode
- UI: Tailwind CSS + shadcn/ui (dark theme, mobile-first)
- Backend/DB: Supabase (PostgreSQL + Auth + Edge Functions + pg_cron)
- Hosting: Vercel (free tier)
- Data API: CricketData.org (api.cricapi.com) — primary
- Mobile: PWA (installable, add-to-home-screen)
- Auth: Supabase Auth with Google OAuth

## Architecture Rules
- Use Next.js App Router (not Pages Router)
- Use Server Components by default; 'use client' only when needed
- Use Server Actions for mutations (not API routes)
- Use Supabase RLS for authorization — never trust the client
- All env vars with NEXT_PUBLIC_ prefix are client-safe; others are server-only
- No Redux, no TRPC, no Zustand — use React state + server actions
- No extra libraries without asking first

## Mobile Optimization Rules
- Design mobile-first: start at 390px, scale up
- Minimum tap target: 44×44px
- Use `dvh` units instead of `vh` for mobile viewport
- Bottom sheet pattern for selection UI on mobile
- No hover-only interactions — everything must work with touch
- PWA: manifest.json + service worker for add-to-home-screen
- Safe area insets for notched phones

## File Structure
```
src/
├── app/
│   ├── layout.tsx                  # Root layout (dark theme, PWA meta)
│   ├── (app)/                      # Route group — shares nav layout
│   │   ├── layout.tsx              # NavBar wrapper
│   │   ├── dashboard/page.tsx      # Home dashboard
│   │   ├── matches/page.tsx        # All matches list
│   │   ├── match/[id]/
│   │   │   ├── pick/page.tsx       # ⭐ Team selection (most important)
│   │   │   └── scores/page.tsx     # Post-match scoreboard
│   │   ├── leaderboard/page.tsx    # Season + match leaderboards
│   │   ├── leagues/
│   │   │   ├── page.tsx            # My leagues list
│   │   │   └── [id]/page.tsx       # League detail
│   │   ├── profile/page.tsx        # User stats + settings
│   │   ├── h2h/page.tsx            # Head-to-head challenges
│   │   ├── predictions/page.tsx    # Match outcome predictions
│   │   └── admin/
│   │       ├── page.tsx
│   │       ├── match/[id]/page.tsx
│   │       ├── players/page.tsx
│   │       └── tokens/page.tsx
│   ├── auth/                       # Auth callback routes
│   └── login/page.tsx
├── components/
│   ├── ui/                         # shadcn/ui primitives
│   ├── player-card.tsx
│   ├── team-selector.tsx
│   ├── composition-tracker.tsx
│   ├── countdown-timer.tsx
│   ├── match-card.tsx
│   ├── nav-bar.tsx
│   ├── rank-badge.tsx
│   ├── stat-card.tsx
│   ├── team-badge.tsx
│   ├── podium.tsx
│   └── install-prompt.tsx          # PWA install banner
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # createBrowserClient
│   │   ├── server.ts               # createServerClient
│   │   ├── admin.ts                # service_role client (createAdminClient)
│   │   └── middleware.ts
│   ├── api/
│   │   ├── cricapi.ts              # CricketData.org wrapper
│   │   └── cricbuzz.ts             # RapidAPI Cricbuzz backup
│   ├── scoring.ts                  # Fantasy points engine
│   ├── validation.ts               # Team composition rules
│   ├── types.ts
│   └── avatar.ts                   # getInitials, getAvatarColor
├── actions/                        # Server Actions
│   ├── selections.ts
│   ├── scoring.ts
│   ├── matches.ts
│   ├── leagues.ts
│   └── notifications.ts
└── supabase/
    └── migrations/
```

## Coding Conventions
- Use `function` for components, `const` arrow for utilities
- Prefer named exports over default exports
- Error handling: try/catch in server actions, error.tsx boundaries in pages
- Loading states: loading.tsx skeletons per route segment
- Use Zod for form validation
- Comments only for "why", not "what"

## Game Rules Summary
- 11 players per match from combined Playing XI (22 available)
- Composition: 1-4 WK, 3-5 BAT, 1-3 AR, 3-5 BOWL, max 7 per IPL team
- Captain (2×), Vice-Captain (1.5×)
- No budget system — any player is free to pick
- Lock at match start time
- Auto-pick: copies previous match team, no C/VC bonus as penalty
- Scoring: post-match only, rules stored in DB (admin-editable)
- No Result: flat 15 pts to all users

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `vercel --prod` — deploy to production
- `npx supabase db push` — push migrations
- `npx supabase functions deploy` — deploy edge functions

## Learned Patterns & Gotchas

### Supabase: `.maybeSingle()` vs `.single()`
- `.single()` throws `PGRST116` error when zero rows returned — crashes `Promise.all` for new users
- `.maybeSingle()` returns `{ data: null, error: null }` when zero rows — safe for optional queries
- Use `.single()` only when a row is guaranteed (e.g., by DB constraint)
- Use `.maybeSingle()` for: `season_leaderboard` (new users), last completed match, any nullable lookup

### Supabase: Two-Phase Parallel Fetch Pattern
Replace sequential `await` chains with `Promise.all` phases:
```typescript
// Phase 1: all queries that only depend on user.id
const [profileRes, rankRes, matchesRes] = await Promise.all([
  supabase.from("profiles").select("*").eq("id", user.id).single(),
  supabase.from("season_leaderboard").select("*").eq("user_id", user.id).maybeSingle(),
  supabase.from("matches").select("*").eq("status", "upcoming").limit(5),
])

// Phase 2: queries that need Phase 1 IDs — also parallel
const [scoresRes, subsRes] = await Promise.all([
  matchesRes.data?.length
    ? supabase.from("user_match_scores")...in("match_id", matchesRes.data.map(m => m.id))
    : Promise.resolve({ data: [] }),
  ...
])
```
Phase 1 runs in ~50ms instead of ~150ms+ sequential. Same data, same UI, ~75% faster.

### Supabase: Admin Client
Use `createAdminClient()` from `@/lib/supabase/admin` (service_role) for server-side mutations that bypass RLS — scoring updates, admin actions, etc. Never use on the client.

### vaul Drawer: `data-vaul-no-drag`
vaul's drag-to-dismiss gesture intercepts touch events on scrollable areas, making buttons unresponsive. Add `data-vaul-no-drag` to any scrollable container inside a Drawer that contains interactive elements:
```tsx
<div className="px-4 overflow-y-auto" data-vaul-no-drag>
  <Button>This button now works</Button>
</div>
```

### Mobile: Safe-Area-Aware Fixed Positioning
For fixed elements above the bottom nav on notched/gesture phones:
```css
/* Action bar that sits above the 3.5rem nav bar */
bottom: calc(3.5rem + env(safe-area-inset-bottom))

/* Page padding so content isn't hidden behind action bars */
padding-bottom: calc(10rem + env(safe-area-inset-bottom))

/* Scrollable content that respects safe area */
padding-bottom: max(1.5rem, env(safe-area-inset-bottom))
```

### CricAPI: Player Name Matching
CricAPI player names don't match DB names exactly. Use `fuzzyMatchName()` in `src/lib/api/cricapi.ts` for fuzzy matching — handles initials, middle names, and common spelling variants.

### (app) Route Group
The `(app)/` route group shares a layout with `NavBar`. The layout does NOT re-run on soft navigation between routes that share it — only on hard load. Changes to `(app)/layout.tsx` only affect initial page load, not transitions.
