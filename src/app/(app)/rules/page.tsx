import { unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { PageTransition } from "@/components/page-transition"
import type { ScoringCategory } from "@/lib/types"

const CATEGORY_ORDER: ScoringCategory[] = ["batting", "bowling", "fielding", "bonus", "penalty"]
const CATEGORY_LABELS: Record<ScoringCategory, string> = {
  batting: "Batting",
  bowling: "Bowling",
  fielding: "Fielding",
  bonus: "Bonus",
  penalty: "Penalty",
}
const CATEGORY_COLOR: Record<ScoringCategory, string> = {
  batting: "text-[var(--tw-blue-text)]",
  bowling: "text-[var(--tw-purple-text)]",
  fielding: "text-[var(--tw-emerald-text)]",
  bonus: "text-[var(--tw-amber-text)]",
  penalty: "text-[var(--tw-red-text)]",
}

const gameRules = [
  { label: "Squad size", value: "Pick 11 from 22 available (combined Playing XI)" },
  { label: "Wicket-keepers", value: "1 – 4 per team" },
  { label: "Batters", value: "2 – 5 per team" },
  { label: "All-rounders", value: "1 – 3 per team" },
  { label: "Bowlers", value: "2 – 5 per team" },
  { label: "Max per IPL team", value: "7 players" },
  { label: "Captain", value: "2× points multiplier" },
  { label: "Vice-Captain", value: "1.5× points multiplier" },
  { label: "Auto-pick", value: "Copies previous match team — no C/VC bonus" },
  { label: "Lock time", value: "Selections lock at match start" },
  { label: "Abandoned", value: "No points awarded — match doesn't count" },
]

const getCachedScoringRules = unstable_cache(
  async () => {
    const admin = createAdminClient()
    const { data } = await admin
      .from("scoring_rules")
      .select("category, label, points")
      .eq("is_active", true)
      .order("points", { ascending: false })
    return data
  },
  ["scoring-rules"],
  { tags: ["scoring-rules"], revalidate: 86400 }
)

export default async function RulesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const rules = await getCachedScoringRules()

  // Group by category
  type RuleRow = { category: string; label: string; points: number }
  const grouped = new Map<ScoringCategory, RuleRow[]>()
  for (const rule of rules ?? []) {
    const cat = rule.category as ScoringCategory
    const arr = grouped.get(cat) ?? []
    arr.push(rule)
    grouped.set(cat, arr)
  }

  const activeCategories = CATEGORY_ORDER.filter((c) => (grouped.get(c)?.length ?? 0) > 0)

  return (
    <PageTransition>
    <div className="p-4 md:p-6 space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-display">Rules & Guide</h1>
        <p className="text-sm text-muted-foreground mt-1">How to play and point scoring reference</p>
      </div>

      <Tabs defaultValue="how-to-play">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="how-to-play">How to Play</TabsTrigger>
          <TabsTrigger value="scoring">Scoring Guide</TabsTrigger>
        </TabsList>

        {/* ── How to Play ── */}
        <TabsContent value="how-to-play" className="mt-4">
          <Card className="border border-overlay-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Game Rules</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-overlay-border">
              {gameRules.map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0 text-sm">
                  <span className="text-muted-foreground shrink-0">{label}</span>
                  <span className="font-medium text-right">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Scoring Guide ── */}
        <TabsContent value="scoring" className="mt-4 space-y-4">
          {activeCategories.map((cat) => {
            const catRules = grouped.get(cat) ?? []
            return (
              <Card key={cat} className="border border-overlay-border">
                <CardHeader className="pb-3">
                  <CardTitle className={`text-base flex items-center gap-2 ${CATEGORY_COLOR[cat]}`}>
                    {CATEGORY_LABELS[cat]}
                    <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground border-overlay-border">
                      {catRules.length} rules
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-overlay-border">
                  {catRules.map((rule) => (
                    <div key={rule.label} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 text-sm">
                      <span className="text-foreground/90">{rule.label}</span>
                      <span className={`font-semibold tabular-nums shrink-0 ml-4 ${rule.points >= 0 ? "text-green-400" : "text-[var(--tw-red-text)]"}`}>
                        {rule.points > 0 ? "+" : ""}{rule.points}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>
      </Tabs>
    </div>
    </PageTransition>
  )
}
