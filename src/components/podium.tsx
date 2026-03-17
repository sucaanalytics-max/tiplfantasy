"use client"

import { motion } from "framer-motion"
import { RankBadge } from "@/components/rank-badge"
import { getInitials, getAvatarColor } from "@/lib/avatar"

type PodiumEntry = {
  name: string
  points: number
  rank: number
  isCurrentUser?: boolean
}

const podiumConfig = [
  { index: 1, height: 72, gradient: "from-gray-300/20 to-gray-400/10 border-t-2 border-gray-400/40" },
  { index: 0, height: 96, gradient: "from-amber-400/20 to-yellow-500/10 border-t-2 border-amber-400/40" },
  { index: 2, height: 56, gradient: "from-amber-700/20 to-amber-800/10 border-t-2 border-amber-700/40" },
]

export function Podium({ entries }: { entries: PodiumEntry[] }) {
  if (entries.length < 3) return null

  return (
    <div className="flex items-end justify-center gap-3 px-4 pb-2 pt-6">
      {podiumConfig.map(({ index, height, gradient }, i) => {
        const entry = entries[index]
        if (!entry) return null
        return (
          <motion.div
            key={entry.rank}
            className="flex flex-col items-center gap-2 flex-1 max-w-[120px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.15, ease: "easeOut" }}
          >
            {/* Avatar + rank badge */}
            <div className="relative">
              <div
                className={`h-12 w-12 rounded-full ${getAvatarColor(entry.name)} flex items-center justify-center ring-2 ring-background`}
              >
                <span className="text-white text-sm font-semibold">
                  {getInitials(entry.name)}
                </span>
              </div>
              <div className="absolute -bottom-1 -right-1">
                <RankBadge rank={entry.rank} size="sm" />
              </div>
            </div>

            {/* Name */}
            <p className="text-xs font-medium text-center truncate w-full">
              {entry.name}
              {entry.isCurrentUser && (
                <span className="text-primary ml-1">(you)</span>
              )}
            </p>

            {/* Points */}
            <p className="text-sm font-bold font-display">{entry.points} pts</p>

            {/* Podium bar — animates upward */}
            <motion.div
              className={`w-full rounded-t-lg bg-gradient-to-b ${gradient}`}
              initial={{ height: 0 }}
              animate={{ height }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.15, ease: "easeOut" }}
            />
          </motion.div>
        )
      })}
    </div>
  )
}
