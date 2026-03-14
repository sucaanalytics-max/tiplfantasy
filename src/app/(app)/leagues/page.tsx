import { getMyLeagues } from "@/actions/leagues"
import { LeaguesClient } from "./leagues-client"

export default async function LeaguesPage() {
  const leagues = await getMyLeagues()
  return <LeaguesClient leagues={leagues} />
}
