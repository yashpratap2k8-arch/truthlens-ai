import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Filter,
  History as HistoryIcon,
  Link2,
  Search,
  Sparkles,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { VERDICT_ORDER, fmtDate, pct } from '../constants'
import VerdictBadge from './Badge'
import ResultCard from './ResultCard'
import { Skeleton } from './Loader'

const LIMIT = 8
const SOURCE_ICON = { text: Type, url: Link2, file: FileText }

export default function History() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [verdict, setVerdict] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [opening, setOpening] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    api
      .history({ limit: LIMIT, offset, verdict })
      .then((d) => {
        setItems(d.items)
        setTotal(d.total)
        if (d.items.length === 0 && offset > 0) setOffset(Math.max(0, offset - LIMIT))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [offset, verdict, user])

  useEffect(() => {
    load()
  }, [load])

  function open(id) {
    setOpening(true)
    api
      .historyItem(id)
      .then(setSelected)
      .catch((e) => setError(e.message))
      .finally(() => setOpening(false))
  }

  function remove(id, e) {
    if (e) e.stopPropagation()
    api.deleteItem(id).then(load).catch((err) => setError(err.message))
  }

  function clearAll() {
    if (!window.confirm('Delete all recorded analyses in this view? This cannot be undone.')) return
    api
      .clearHistory()
      .then(() => {
        setOffset(0)
        load()
      })
      .catch((e) => setError(e.message))
  }

  // Filter loaded items by search keyword
  const filteredItems = items.filter((it) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      (it.title || '').toLowerCase().includes(q) ||
      (it.snippet || '').toLowerCase().includes(q) ||
      (it.source_ref || '').toLowerCase().includes(q)
    )
  })

  const page = Math.floor(offset / LIMIT) + 1
  const pages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/80 pb-6 dark:border-white/[0.08]">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300 mb-2">
            <HistoryIcon className="h-3.5 w-3.5" />
            <span>Audit &amp; Intelligence Log</span>
          </div>
          <h1 className="text-3xl font-extrabold sm:text-4xl text-slate-900 dark:text-white">
            Analysis <span className="gradient-text">History</span>
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {total} stored {total === 1 ? 'record' : 'records'}
            {user ? (
              <span className="font-semibold text-violet-600 dark:text-violet-400">
                {' '}
                · Signed in as {user.name || user.email}
              </span>
            ) : (
              <span> · Anonymous session</span>
            )}
          </p>
        </div>

        {/* Clear All Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={clearAll}
            disabled={total === 0 && !verdict}
            className="btn-ghost text-rose-600 dark:text-rose-400 text-xs font-semibold !py-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="glass p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-lg">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            className="input !py-2 !pl-10 text-xs sm:text-sm"
            placeholder="Search through recorded headlines, sources, or snippets…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Verdict filter dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400 hidden sm:block" />
          <select
            className="input !w-auto !py-2 text-xs sm:text-sm font-medium"
            value={verdict}
            aria-label="Filter by verdict"
            onChange={(e) => {
              setOffset(0)
              setVerdict(e.target.value)
            }}
          >
            <option value="">All verdicts</option>
            {VERDICT_ORDER.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs sm:text-sm text-rose-700 dark:text-rose-300" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
          <span className="flex-1 font-medium">{error}</span>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* History Items List */}
      {loading ? (
        <div className="space-y-3.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full !rounded-2xl" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="glass p-12 sm:p-16 text-center shadow-xl">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/20">
            <HistoryIcon className="h-7 w-7" />
          </div>
          <p className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            {searchQuery
              ? 'No analyses match your search query.'
              : verdict
              ? `No records found with status “${verdict}”.`
              : 'No analyses recorded yet.'}
          </p>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? 'Try modifying your keyword or clearing the filter.'
              : 'Every headline, link, or text document you analyze is automatically logged here.'}
          </p>
          {!searchQuery && !verdict && (
            <a href="#/analyze" className="btn-primary mt-6 text-xs sm:text-sm">
              <Sparkles className="h-4 w-4" />
              <span>Analyze Content Now</span>
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((it) => {
            const Icon = SOURCE_ICON[it.source_type] || Type
            return (
              <div
                key={it.id}
                onClick={() => open(it.id)}
                className="glass-card group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 cursor-pointer"
              >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300 ring-1 ring-slate-200 dark:ring-white/[0.08] transition-colors group-hover:bg-violet-500/15 group-hover:text-violet-600 dark:group-hover:text-violet-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="truncate font-bold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                        {it.title || 'Untitled snippet'}
                      </span>
                      {it.source_ref && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:bg-white/[0.05] dark:text-slate-400 truncate max-w-[200px]">
                          {it.source_ref}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-mono">
                      {it.snippet}
                    </p>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-0.5">
                      <span>{fmtDate(it.created_at)}</span>
                      <span>·</span>
                      <span className="capitalize">{it.source_type}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3.5 border-t border-slate-200/60 sm:border-t-0 pt-3 sm:pt-0 dark:border-white/[0.06]">
                  <div className="text-left sm:text-right">
                    <VerdictBadge verdict={it.verdict} />
                    <span className="mt-1 block font-mono text-[11px] text-slate-500">
                      {pct(it.confidence, 1)} confidence
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        open(it.id)
                      }}
                      className="btn-ghost !p-2 rounded-lg text-slate-500 hover:text-violet-500"
                      title="Inspect Diagnostic"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => remove(it.id, e)}
                      className="btn-ghost !p-2 rounded-lg text-slate-400 hover:text-rose-500"
                      title="Delete record"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {total > LIMIT && (
        <div className="flex items-center justify-center gap-3 pt-4 text-xs font-semibold">
          <button
            className="btn-secondary !py-2 !px-3"
            disabled={offset === 0}
            onClick={() => setOffset(offset - LIMIT)}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Prev</span>
          </button>
          <span className="text-slate-500 dark:text-slate-400 font-mono">
            Page {page} of {pages}
          </span>
          <button
            className="btn-secondary !py-2 !px-3"
            disabled={page >= pages}
            onClick={() => setOffset(offset + LIMIT)}
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Inspect Detail Modal */}
      {(selected || opening) && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-md animate-fade-in"
          onClick={() => setSelected(null)}
        >
          <div
            className="mx-auto max-w-4xl py-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-400" />
                Diagnostic Record Detail
              </span>
              <button
                className="btn-secondary !py-1.5 !px-3 text-xs"
                onClick={() => setSelected(null)}
              >
                <X className="h-4 w-4" />
                <span>Close</span>
              </button>
            </div>
            {selected ? (
              <ResultCard result={selected} />
            ) : (
              <Skeleton className="h-72 w-full !rounded-2xl" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
