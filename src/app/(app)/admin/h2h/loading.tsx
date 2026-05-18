export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-overlay-subtle rounded" />
      <div className="glass rounded-2xl p-3 h-16" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass rounded-2xl p-3 h-20" />
        <div className="glass rounded-2xl p-3 h-20" />
        <div className="glass rounded-2xl p-3 h-20" />
        <div className="glass rounded-2xl p-3 h-20" />
      </div>
      <div className="glass rounded-2xl h-96" />
    </div>
  )
}
