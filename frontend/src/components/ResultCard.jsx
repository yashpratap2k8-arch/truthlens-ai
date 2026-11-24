import { useEffect, useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ExternalLink,
  FileText,
  Info,
  Link2,
  ListChecks,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  Type,
  User,
} from 'lucide-react'
import VerdictBadge from './Badge'
import HighlightedText from './HighlightedText'
import { VERDICTS, fmtDate, pct } from '../constants'
import { useAI } from '../context/AIContext'

const SOURCE_ICON = { text: Type, url: Link2, file: FileText }

function Section({ title, children, className = '', badge = null }) {
  return (
    <section className={`glass-card p-6 sm:p-7 ${className}`}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
        {badge && <span className="text-xs text-slate-400 font-mono">{badge}</span>}
      </div>
      {children}
    </section>
  )
}

function Ring({ value, color, verdictKey }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setShown(value), 60)
    return () => clearTimeout(t)
  }, [value])
  const r = 52
  const c = 2 * Math.PI * r

  return (
    <div className="relative h-40 w-40 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          className="stroke-slate-200/80 dark:stroke-white/[0.08]"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-3xl font-extrabold text-slate-900 dark:text-white">
            {pct(value, 1)}
          </div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">
            Model Confidence
          </div>
          <div className="text-[9px] text-slate-400 dark:text-slate-500">
            Pattern Match
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResultCard({ result }) {
  const { openAssistant } = useAI()
  const v = VERDICTS[result.verdict] || VERDICTS['Needs Verification']
  const SourceIcon = SOURCE_ICON[result.source_type] || Type
  const words = result.influential_words.map((w) => ({
    word: w.word,
    value: w.weight,
  }))
  const isUrl = result.source_type === 'url' && /^https?:\/\//.test(result.source_ref || '')
  const hasExternalMatches =
    result.external_fact_check?.status === 'success' &&
    result.external_fact_check.matches?.length > 0

  const handleAskAI = () => {
    openAssistant({
      title: result.title,
      source: result.source_domain || result.source_ref || (result.source_type === 'url' ? 'Web URL' : 'Pasted Text'),
      source_type: result.source_type,
      source_domain: result.source_domain,
      author: result.author,
      publication_date: result.publication_date,
      prediction: result.model_prediction || result.verdict,
      model_prediction: result.model_prediction || result.verdict,
      confidence: pct(result.confidence, 1),
      verification_status: result.verification_status || 'Needs Verification',
      verification_summary: result.verification_summary,
      indicators: result.suspicious_flags?.map((f) => `${f.label} (${f.count}x)`),
      explanation: Array.isArray(result.explanation) ? result.explanation.join('; ') : result.explanation,
      snippet: result.snippet || result.text?.slice(0, 500),
      text: result.text,
      word_count: result.word_count,
      external_fact_check: result.external_fact_check,
      id: result.id,
    })
  }

  return (
    <div className="animate-fade-up space-y-6">
      {/* Primary Diagnostic Summary Banner */}
      <div className="glass p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col items-center gap-7 sm:flex-row">
          <Ring value={result.confidence} color={v.color} verdictKey={v.key} />

          <div className="w-full min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <VerdictBadge verdict={result.model_prediction || result.verdict} large />
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-500/10 px-3.5 py-1 text-xs sm:text-sm font-semibold text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300">
                  <ShieldQuestion className="h-4 w-4 text-amber-500" />
                  <span>{result.verification_status || 'Needs Verification'}</span>
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Diagnostic ID #{result.id || 'live'}
              </span>
            </div>

            <h2 className="mt-3.5 break-words font-display text-xl sm:text-2xl font-bold leading-snug text-slate-900 dark:text-white">
              {result.title}
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 font-medium">
                <SourceIcon className="h-3.5 w-3.5 text-violet-500" />
                {isUrl ? (
                  <a
                    href={result.source_ref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all underline hover:text-violet-500"
                  >
                    {result.source_domain || result.source_ref}
                  </a>
                ) : (
                  <span>{result.source_domain || result.source_ref || 'Pasted text input'}</span>
                )}
              </span>
              {result.author && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{result.author}</span>
                  </span>
                </>
              )}
              {result.publication_date && (
                <>
                  <span>·</span>
                  <span>Published: {result.publication_date.slice(0, 10)}</span>
                </>
              )}
              <span>·</span>
              <span>{result.word_count} words processed</span>
              {result.created_at && (
                <>
                  <span>·</span>
                  <span>{fmtDate(result.created_at)}</span>
                </>
              )}
            </div>

            {/* Extracted Image Preview if safely available */}
            {result.image_url && (
              <div className="mt-3.5 overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10 max-h-48 w-full sm:max-w-md bg-slate-900/5">
                <img
                  src={result.image_url}
                  alt={result.title}
                  className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                  onError={(e) => { e.currentTarget.parentElement.style.display = 'none' }}
                />
              </div>
            )}

            {/* Split probability bar */}
            <div className="mt-5 rounded-xl bg-slate-100/70 p-3.5 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06]">
              <div className="mb-2 flex justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Real Writing Patterns: {pct(result.real_probability)}</span>
                </span>
                <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Misleading Patterns: {pct(result.fake_probability)}</span>
                </span>
              </div>
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <div
                  className="bg-emerald-500 transition-all duration-1000"
                  style={{ width: pct(result.real_probability, 2) }}
                />
                <div
                  className="bg-rose-500 transition-all duration-1000"
                  style={{ width: pct(result.fake_probability, 2) }}
                />
              </div>
            </div>

            {/* Verification Notice Callout */}
            {result.verification_summary && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-3.5 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                <p>
                  <strong className="font-bold">Verification Notice: </strong>
                  {result.verification_summary}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Disclaimer Callout */}
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p>{result.disclaimer}</p>
        </div>

        {result.truncated && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Note: The text exceeded the 30,000 character buffer and was truncated for vectorization.
          </p>
        )}

        {/* AI Assistant Explanation Banner */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-600/15 via-indigo-600/10 to-fuchsia-600/10 p-4 shadow-inner">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-600/20 text-violet-400 ring-1 ring-violet-500/30">
              <Bot className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                TruthLens AI Assistant
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Want to understand why the model predicts <strong className="font-semibold text-violet-600 dark:text-violet-300">{result.model_prediction || result.verdict}</strong> ({pct(result.confidence, 1)}) or what Needs Verification means?
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAskAI}
            className="btn-primary shrink-0 !py-2 !px-4 text-xs flex items-center gap-2 shadow-lg shadow-violet-500/20 w-full sm:w-auto justify-center"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Ask AI to Explain This Result</span>
          </button>
        </div>
      </div>

      {/* 4-Pillar Diagnostic Clarity Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card p-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            1. Model Prediction
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <VerdictBadge verdict={result.model_prediction || result.verdict} />
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Linguistic style classification
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            2. Model Confidence
          </div>
          <div className="mt-1 font-display text-2xl font-extrabold text-violet-600 dark:text-violet-400">
            {pct(result.confidence, 1)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Statistical pattern match certainty
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            3. Verification Status
          </div>
          <div className="mt-1 text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <ShieldQuestion className="h-4 w-4 shrink-0" />
            <span className="truncate">{result.verification_status || 'Needs Verification'}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Requires external fact evidence
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            4. External Evidence
          </div>
          <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200">
            {hasExternalMatches ? (
              <span className="text-violet-600 dark:text-violet-400">
                {result.external_fact_check.matches.length} Matches Found
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">No Fact-Check Matches</span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {hasExternalMatches ? 'Google Fact Check Tools API' : 'No matching claims indexed'}
          </div>
        </div>
      </div>

      {/* Grid: Reason & Influential Vocabulary */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Diagnostic Reasoning" badge="Explainable AI">
          <ul className="space-y-3 text-xs sm:text-sm leading-relaxed">
            {result.explanation.map((line, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50/50 p-3 dark:border-white/[0.05] dark:bg-white/[0.02]">
                <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                <span className="text-slate-700 dark:text-slate-200">{line}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Influential Vocabulary Weights" badge="TF-IDF × Weights">
          {words.length === 0 ? (
            <p className="text-xs sm:text-sm text-slate-500 py-8 text-center">
              No known terms from the model vocabulary were identified in this sample.
            </p>
          ) : (
            <>
              <div className="h-72 text-slate-500 dark:text-slate-400">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={words} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="word"
                      width={110}
                      tick={{ fill: 'currentColor', fontSize: 11, fontFamily: 'monospace' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(139, 92, 246, 0.08)' }}
                      contentStyle={{
                        backgroundColor: '#0c1022',
                        borderRadius: 12,
                        borderColor: 'rgba(255,255,255,0.1)',
                        color: '#f8fafc',
                        fontSize: 12,
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                      }}
                      formatter={(val) => [
                        Math.abs(val).toFixed(4),
                        val > 0 ? 'Pushes toward Fake' : 'Pushes toward Real',
                      ]}
                    />
                    <Bar dataKey="value" radius={4} isAnimationActive>
                      {words.map((w, i) => (
                        <Cell key={i} fill={w.value > 0 ? '#f43f5e' : '#10b981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/80 pt-2 dark:border-white/[0.06]">
                <span className="text-emerald-500 font-medium">← Green pushes toward Real</span>
                <span className="text-rose-500 font-medium">Red pushes toward Fake →</span>
              </div>
            </>
          )}
        </Section>
      </div>

      {/* Highlighted text preview */}
      <Section title="Analyzed Text &amp; Token Highlights" badge="Interactive Span Inspection">
        <HighlightedText text={result.text} highlights={result.highlights} />
      </Section>

      {/* External Verified Matches (Google Fact Check Tools API) */}
      {hasExternalMatches && (
        <Section title="Published Fact-Checks (Google Fact Check Tools API)" badge="Verified Claims">
          <div className="space-y-3">
            {result.external_fact_check.matches.map((claim, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-4 text-xs sm:text-sm space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-slate-800 dark:text-slate-100">
                    “{claim.claim}”
                  </p>
                  {claim.claimant && (
                    <span className="rounded-md bg-slate-200 dark:bg-white/10 px-2 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                      Claimant: {claim.claimant}
                    </span>
                  )}
                </div>
                {claim.reviews?.map((rev, rIdx) => (
                  <div
                    key={rIdx}
                    className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 dark:border-white/[0.06] pt-2 text-xs"
                  >
                    <span className="font-semibold text-violet-600 dark:text-violet-400">
                      {rev.publisher || 'Fact-Checker'}
                      {rev.rating && (
                        <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300 font-bold">
                          Rating: {rev.rating}
                        </span>
                      )}
                    </span>
                    {rev.url && (
                      <a
                        href={rev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-slate-500 hover:text-violet-500 underline"
                      >
                        Read review <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Heuristics & Direct Search Links */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Writing Style Heuristics" badge="Sensationalism / Urgency">
          {result.suspicious_flags.length === 0 ? (
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 py-4">
              No prominent sensational wording, conspiracy framing, or viral share-pressure flags were detected.
            </p>
          ) : (
            <ul className="space-y-3">
              {result.suspicious_flags.map((f) => (
                <li
                  key={f.type}
                  className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs sm:text-sm"
                >
                  <div className="flex items-center justify-between font-bold text-amber-900 dark:text-amber-200">
                    <span>{f.label}</span>
                    <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-mono">
                      {f.count}× detected
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 font-mono">
                    Examples: {f.examples.join(', ')}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            Heuristic matching checks for psychological manipulation tactics, not empirical accuracy.
          </p>
        </Section>

        <Section title="Direct Fact-Checker Search" badge="Cross-Verification">
          <ul className="space-y-2.5">
            {result.fact_check_links.map((l) => (
              <li key={l.name}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 p-3.5 text-xs sm:text-sm transition-all hover:border-violet-400 hover:bg-violet-500/[0.04] dark:border-white/[0.08]"
                >
                  <div>
                    <span className="block font-bold text-slate-800 dark:text-slate-100 group-hover:text-violet-500 transition-colors">
                      {l.name}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {l.note}
                    </span>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-violet-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  )
}
