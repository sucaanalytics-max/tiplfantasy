import type { SupabaseClient } from "@supabase/supabase-js"

export const PAGE_SIZE = 1000

/**
 * Fetch every row from a single-table `.select().in()` query, paginated.
 *
 * Why this exists: Supabase enforces a hard server-side cap of 1000 rows per
 * response, regardless of `.limit()` or `.range()`. A naïve query against
 * `match_player_scores` for ALL completed matches silently returns only the
 * first 1000 rows once the season grows past ~45 matches × 22 players.
 *
 * Pages must be deterministically ordered so consecutive `.range()` windows
 * don't drop or duplicate rows — we order by `id` (UUID) for stability.
 */
export async function fetchAllIn<T>(
  supabase: SupabaseClient,
  table: string,
  selectCols: string,
  filterColumn: string,
  filterValues: string[]
): Promise<T[]> {
  if (filterValues.length === 0) return []
  const all: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(selectCols)
      .in(filterColumn, filterValues)
      .order("id")
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as T[]))
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}
