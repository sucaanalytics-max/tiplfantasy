"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { grantTokens, bulkGrantTokens } from "@/actions/h2h"
import { useRouter } from "next/navigation"
import { Coins, Users, ArrowLeft } from "lucide-react"
import Link from "next/link"

type UserRow = {
  id: string
  display_name: string
  balance: number
}

export function TokenManagementClient({ users }: { users: UserRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [bulkAmount, setBulkAmount] = useState("100")
  const [grantUserId, setGrantUserId] = useState("")
  const [grantAmount, setGrantAmount] = useState("")

  const totalTokens = users.reduce((sum, u) => sum + u.balance, 0)

  const handleBulkGrant = () => {
    const amount = parseInt(bulkAmount)
    if (!amount || amount <= 0) return
    startTransition(async () => {
      const result = await bulkGrantTokens(amount)
      if (result.error) alert(result.error)
      else {
        alert(`Granted ${amount} tokens to ${result.count} users`)
        router.refresh()
      }
    })
  }

  const handleGrant = () => {
    const amount = parseInt(grantAmount)
    if (!grantUserId || !amount) return
    startTransition(async () => {
      const result = await grantTokens(grantUserId, amount)
      if (result.error) alert(result.error)
      else {
        setGrantAmount("")
        setGrantUserId("")
        router.refresh()
      }
    })
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div>
        <Link href="/admin" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-2">
          <ArrowLeft className="h-4 w-4" /> Back to Admin
        </Link>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Coins className="h-6 w-6" /> Token Management
        </h1>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{users.length}</p>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{totalTokens}</p>
            <p className="text-xs text-muted-foreground">Total Tokens in Circulation</p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Grant */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Bulk Grant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              value={bulkAmount}
              onChange={(e) => setBulkAmount(e.target.value)}
              placeholder="Amount"
              className="w-32"
            />
            <Button onClick={handleBulkGrant} disabled={isPending}>
              {isPending ? "Granting..." : `Grant ${bulkAmount} to all users`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Individual Grant */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Grant to Individual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <select
              value={grantUserId}
              onChange={(e) => setGrantUserId(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select user...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name} ({u.balance} tokens)
                </option>
              ))}
            </select>
            <Input
              type="number"
              value={grantAmount}
              onChange={(e) => setGrantAmount(e.target.value)}
              placeholder="Amount"
              className="w-24"
            />
            <Button onClick={handleGrant} disabled={isPending || !grantUserId || !grantAmount}>
              Grant
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* User balances */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">User Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50">
                <span className="text-sm font-medium">{u.display_name}</span>
                <Badge variant="outline" className="font-mono">
                  {u.balance} tokens
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
