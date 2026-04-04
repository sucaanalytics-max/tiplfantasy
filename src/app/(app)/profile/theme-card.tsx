"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"

export function ThemeCard() {
  return (
    <Card className="border border-white/[0.06]">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Appearance</p>
            <p className="text-xs text-muted-foreground">
              Switch between light and dark theme
            </p>
          </div>
          <ThemeToggle className="h-10 w-10 rounded-full border border-white/[0.06] flex items-center justify-center text-foreground hover:bg-secondary transition-colors" />
        </div>
      </CardContent>
    </Card>
  )
}
