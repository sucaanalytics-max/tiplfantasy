"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { RawBanterMessage } from "@/lib/banter-curation"

interface Props {
  messages: RawBanterMessage[]
}

export function MatchMomentsSection({ messages }: Props) {
  const [open, setOpen] = useState(false)

  if (messages.length === 0) return null

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 glass rounded-2xl text-sm font-medium hover:bg-overlay-subtle transition-colors"
      >
        <span>⚡ Match Moments ({messages.length})</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="space-y-2 px-1">
          {messages.map((msg, i) => (
            <div key={i} className="glass rounded-xl px-4 py-3 text-sm text-foreground/90 leading-relaxed">
              {msg.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
