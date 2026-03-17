"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { updateDisplayName } from "@/actions/profile"

export function ProfileNameForm({ currentName }: { currentName: string }) {
  const [name, setName] = useState(currentName)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const router = useRouter()

  const isDirty = name.trim() !== currentName

  function handleSave() {
    startTransition(async () => {
      const res = await updateDisplayName(name)
      if (res.error) {
        setMessage({ type: "error", text: res.error })
      } else {
        setMessage({ type: "success", text: "Name updated!" })
        router.refresh()
      }
      setTimeout(() => setMessage(null), 3000)
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your display name"
          maxLength={30}
          className="flex-1"
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isPending || !isDirty}
        >
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>
      {message && (
        <p className={`text-xs ${message.type === "success" ? "text-status-success" : "text-status-danger"}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
