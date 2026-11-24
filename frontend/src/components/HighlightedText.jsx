import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

const CLASSES = {
  suspicious: 'bg-amber-300/40 text-amber-950 dark:text-amber-200 underline decoration-wavy decoration-amber-500 dark:bg-amber-400/25 font-medium px-1 rounded',
  fake: 'bg-rose-400/30 text-rose-950 dark:text-rose-200 font-medium px-1 rounded dark:bg-rose-500/25 ring-1 ring-rose-500/20',
  real: 'bg-emerald-400/30 text-emerald-950 dark:text-emerald-200 font-medium px-1 rounded dark:bg-emerald-500/25 ring-1 ring-emerald-500/20',
}
const TIPS = {
  suspicious: 'Sensational / suspicious-style wording (heuristic)',
  fake: 'Pushes the model toward "fake"',
  real: 'Pushes the model toward "real"',
}

function Legend({ kind, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      <span className={`inline-block h-3 w-4 rounded ${CLASSES[kind]}`} />
      <span>{label}</span>
    </span>
  )
}

// highlights = [{start, end, kind}] sorted and non-overlapping (computed by the backend)
export default function HighlightedText({ text, highlights }) {
  const [copied, setCopied] = useState(false)
  const parts = []
  let pos = 0
  highlights.forEach((h, i) => {
    if (h.start > pos) parts.push(text.slice(pos, h.start))
    parts.push(
      <mark key={i} title={TIPS[h.kind]} className={`text-inherit ${CLASSES[h.kind]}`}>
        {text.slice(h.start, h.end)}
      </mark>,
    )
    pos = h.end
  })
  parts.push(text.slice(pos))

  function copyText() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Legend kind="suspicious" label="Suspicious Heuristic" />
          <Legend kind="fake" label="Pushes Fake" />
          <Legend kind="real" label="Pushes Real" />
        </div>
        <button
          onClick={copyText}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08] transition"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copied' : 'Copy Text'}</span>
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200/80 bg-slate-100/60 p-4 text-xs sm:text-sm leading-7 dark:border-white/[0.08] dark:bg-[#070b19]/80 font-mono">
        {parts}
      </div>
    </div>
  )
}
