import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { LucideIcon } from "lucide-react"

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: { label: string; href: string }
}) {
  return (
    <div className="flex flex-col items-center text-center py-16 gap-3 animate-fade-in">
      <div className="rounded-full glass p-4">
        <Icon className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-[280px]">{description}</p>
      </div>
      {action && (
        <Link href={action.href} className="mt-2">
          <Button variant="outline" size="sm">{action.label}</Button>
        </Link>
      )}
    </div>
  )
}
