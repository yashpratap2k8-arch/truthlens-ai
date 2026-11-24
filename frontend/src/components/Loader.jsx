import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

export function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-shimmer rounded-xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] dark:from-white/[0.04] dark:via-white/[0.09] dark:to-white/[0.04] border border-slate-200/40 dark:border-white/[0.05] ${className}`}
    />
  )
}

// Animated AI diagnostic loader displaying real sequential pipeline stages
export default function Loader({ steps }) {
  const [i, setI] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), 1100)
    return () => clearInterval(t)
  }, [steps.length])

  const progress = Math.round(((i + 1) / steps.length) * 100)

  return (
    <div
      className="glass animate-fade-up p-8 sm:p-10 text-center max-w-xl mx-auto shadow-2xl relative overflow-hidden"
      role="status"
      aria-live="polite"
    >
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-violet-500 via-indigo-500 to-fuchsia-500 animate-pulse" />

      {/* Orbiting spinner with glowing core */}
      <div className="relative mx-auto mb-6 h-20 w-20">
        <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-violet-500 border-r-fuchsia-500 [animation-duration:1.2s]" />
        <div className="absolute inset-2.5 rounded-full bg-gradient-to-br from-violet-500/15 via-indigo-500/10 to-transparent blur-sm" />
        <div className="absolute inset-0 grid place-items-center text-violet-500">
          <Sparkles className="h-6 w-6 animate-pulse" />
        </div>
      </div>

      {/* Current stage title */}
      <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300 font-mono mb-2">
        <span>Step {i + 1} of {steps.length}</span>
        <span>·</span>
        <span>{progress}%</span>
      </div>

      <p className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white transition-all duration-300">
        {steps[i]}
      </p>

      {/* Progress track */}
      <div className="mx-auto mt-6 max-w-sm">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-fuchsia-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Simulated skeleton preview */}
      <div className="mx-auto mt-6 max-w-md space-y-2.5 pt-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5 mx-auto" />
      </div>
    </div>
  )
}
