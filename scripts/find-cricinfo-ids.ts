/**
 * Find ESPNcricinfo IDs for players missing stats.
 *
 * Uses CricSheet's people.csv register to map player names → cricinfo IDs.
 * Run: npx tsx scripts/find-cricinfo-ids.ts
 */

import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"

// Load .env.local manually
const envPath = path.join(__dirname, "..", ".env.local")
const envContent = fs.readFileSync(envPath, "utf-8")
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim()
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface CricsheetPerson {
  name: string
  uniqueName: string
  cricinfoId: string | null
}

function loadPeopleRegister(): CricsheetPerson[] {
  const csvPath = path.join(__dirname, "people.csv")
  const csv = fs.readFileSync(csvPath, "utf-8")
  const lines = csv.trim().split("\n")
  const header = lines[0].split(",")

  const nameIdx = header.indexOf("name")
  const uniqueNameIdx = header.indexOf("unique_name")
  const cricinfoIdx = header.indexOf("key_cricinfo")

  return lines.slice(1).map((line) => {
    const cols = line.split(",")
    return {
      name: cols[nameIdx]?.trim() ?? "",
      uniqueName: cols[uniqueNameIdx]?.trim() ?? "",
      cricinfoId: cols[cricinfoIdx]?.trim() || null,
    }
  }).filter((p) => p.cricinfoId)
}

// Also load the player-name-map to check reverse mappings
function loadNameMap(): Record<string, string> {
  const mapPath = path.join(__dirname, "player-name-map.json")
  if (!fs.existsSync(mapPath)) return {}
  return JSON.parse(fs.readFileSync(mapPath, "utf-8"))
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

// Try multiple matching strategies
function findCricinfoId(
  dbName: string,
  register: CricsheetPerson[],
  nameMap: Record<string, string>
): { cricinfoId: string; matchedVia: string } | null {
  const normDbName = normalize(dbName)

  // Strategy 1: Direct unique_name match (CricSheet unique names look like "Sarfaraz Khan (2)")
  for (const p of register) {
    const baseName = p.uniqueName.replace(/\s*\(\d+\)\s*$/, "")
    if (normalize(baseName) === normDbName) {
      return { cricinfoId: p.cricinfoId!, matchedVia: `unique_name: ${p.uniqueName}` }
    }
  }

  // Strategy 2: Direct name match
  for (const p of register) {
    if (normalize(p.name) === normDbName) {
      return { cricinfoId: p.cricinfoId!, matchedVia: `name: ${p.name}` }
    }
  }

  // Strategy 3: Check name map — the map has CricSheet names as keys
  // If DB name appears as a value in the map, find its CricSheet key
  for (const [cricsheetName, targetName] of Object.entries(nameMap)) {
    if (normalize(targetName) === normDbName) {
      // Now find this cricsheet name in the register
      for (const p of register) {
        if (normalize(p.name) === normalize(cricsheetName)) {
          return { cricinfoId: p.cricinfoId!, matchedVia: `name_map: ${cricsheetName} → ${targetName}` }
        }
      }
    }
  }

  // Strategy 4: Last name + first initial match (for names like "AM Ghazanfar" vs "Allah Mohammad Ghazanfar")
  const parts = normDbName.split(" ")
  if (parts.length >= 2) {
    const lastName = parts[parts.length - 1]
    const firstInitial = parts[0][0]
    for (const p of register) {
      const regParts = normalize(p.name).split(" ")
      if (regParts.length >= 2) {
        const regLastName = regParts[regParts.length - 1]
        const regFirstInitial = regParts[0][0]
        if (regLastName === lastName && regFirstInitial === firstInitial && regParts.length > 1) {
          // Additional check: make sure it's not too ambiguous
          return { cricinfoId: p.cricinfoId!, matchedVia: `initial_match: ${p.name}` }
        }
      }
    }
  }

  return null
}

async function main() {
  console.log("=== Find ESPNcricinfo IDs for Missing Players ===\n")

  // Load register
  const register = loadPeopleRegister()
  console.log(`Loaded ${register.length} entries from CricSheet people register`)

  const nameMap = loadNameMap()
  console.log(`Loaded ${Object.keys(nameMap).length} entries from player-name-map.json`)

  // Get players missing stats
  const { data: players, error } = await supabase
    .from("players")
    .select("id, name")
    .is("howstat_id", null)
    .eq("is_active", true)
    .order("name")

  if (error) {
    console.error("DB error:", error.message)
    process.exit(1)
  }

  console.log(`Found ${players!.length} active players without howstat_id\n`)

  const matched: Array<{ name: string; id: string; cricinfoId: string; via: string }> = []
  const unmatched: string[] = []

  for (const player of players!) {
    const result = findCricinfoId(player.name, register, nameMap)
    if (result) {
      matched.push({
        name: player.name,
        id: player.id,
        cricinfoId: result.cricinfoId,
        via: result.matchedVia,
      })
    } else {
      unmatched.push(player.name)
    }
  }

  console.log(`\n--- MATCHED (${matched.length}) ---`)
  for (const m of matched) {
    console.log(`  ${m.name} → cricinfo_id=${m.cricinfoId} (via ${m.via})`)
  }

  console.log(`\n--- UNMATCHED (${unmatched.length}) ---`)
  for (const name of unmatched) {
    console.log(`  ${name}`)
  }

  // Output SQL
  console.log("\n--- SQL UPDATE STATEMENTS ---")
  for (const m of matched) {
    console.log(`UPDATE players SET cricinfo_id = ${m.cricinfoId} WHERE name = '${m.name.replace(/'/g, "''")}' AND cricinfo_id IS NULL;`)
  }
}

main().catch(console.error)
