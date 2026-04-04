import { Skeleton } from "@/components/ui/skeleton"

export function PageLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  )
}

export function DashboardLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl lg:max-w-5xl">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="lg:grid lg:grid-cols-5 lg:gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <div className="lg:col-span-2 space-y-6 mt-6 lg:mt-0">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export function PickTeamLoading() {
  return (
    <div className="space-y-0">
      <div className="p-4 space-y-3 border-b border-white/[0.06]">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="p-4 space-y-1">
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 flex-1 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px p-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

export function LeaderboardLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl lg:max-w-4xl">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

export function MatchesLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl lg:max-w-5xl">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export function ScoresLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl lg:max-w-4xl">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-20 rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

export function ProfileLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl lg:max-w-4xl">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-24 rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  )
}
