// Pure function — no imports, fully testable in isolation.

export type RawBanterMessage = {
  message: string
  event_type: string
}

// Priority order — captain drama first, then player events, then general
const BANTER_PRIORITY: string[] = [
  "captain_haul",
  "captain_fail",
  "vc_fail",
  "duck",
  "century",
  "fifty",
  "three_plus_wickets",
  "wicketless",
  "expensive_bowling",
  "great_economy",
  "general_roast",
  "low_sr",
  "top_rank",
  "bottom_rank",
]

const MAX_BANTER = 8
// captain_haul and captain_fail can have up to 2 each (different user outcomes)
const MAX_PER_DRAMA_TYPE = 2
const MAX_PER_OTHER_TYPE = 1

/**
 * Deduplicates and prioritises banter messages for a single match.
 * Returns at most MAX_BANTER (8) messages.
 * For captain_haul / captain_fail: up to 2 messages each (different user outcomes).
 * For all other types: 1 message per type (longest = most specific).
 */
export function curateBanter(messages: RawBanterMessage[]): RawBanterMessage[] {
  // Group by event_type
  const grouped = new Map<string, RawBanterMessage[]>()
  for (const msg of messages) {
    if (!grouped.has(msg.event_type)) grouped.set(msg.event_type, [])
    grouped.get(msg.event_type)!.push(msg)
  }

  const result: RawBanterMessage[] = []

  for (const eventType of BANTER_PRIORITY) {
    if (result.length >= MAX_BANTER) break
    const group = grouped.get(eventType)
    if (!group || group.length === 0) continue

    const isDramaType = eventType === "captain_haul" || eventType === "captain_fail"
    const maxForType = isDramaType ? MAX_PER_DRAMA_TYPE : MAX_PER_OTHER_TYPE

    // Sort by message length descending — longest = most specific / personalized
    const sorted = [...group].sort((a, b) => b.message.length - a.message.length)
    const take = Math.min(maxForType, MAX_BANTER - result.length)
    result.push(...sorted.slice(0, take))
  }

  return result
}
