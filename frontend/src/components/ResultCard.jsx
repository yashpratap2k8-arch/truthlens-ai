import { useEffect, useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileQuestion,
  FileText,
  HelpCircle,
  Info,
  Link2,
  ListChecks,
  RefreshCw,
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

function Ring({ value, displayValue, color }) {
  const isNA = !value || value === 0 || (displayValue && displayValue.startsWith('N/A'))
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setShown(isNA ? 0 : value), 60)
    return () => clearTimeout(t)
  }, [value, isNA])
  const r = 52
  const c = 2 * Math.PI * r

  return (
    <div className="relative h-36 w-36 sm:h-40 sm:w-40 shrink-0">
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
          stroke={isNA ? '#64748b' : color}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {displayValue || (isNA ? 'N/A' : pct(value, 1))}
          </div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">
            Model Confidence
          </div>
          <div className="text-[9px] text-slate-400 dark:text-slate-500">
            {isNA ? 'Pattern Match N/A' : 'Pattern Match'}
          </div>
        </div>
      </div>
    </div>
  )
}

function getSourceTypeLabel(type) {
  switch (type) {
    case 'official_government': return 'Official Govt'
    case 'official_institution': return 'Official Institution'
    case 'regulatory': return 'Regulatory / Accreditation'
    case 'fact_checker': return 'Fact-Checker'
    case 'gemini_grounding': return 'Gemini Grounding'
    case 'encyclopedic': return 'Authoritative Record'
    case 'reputable_news': return 'Reputable News'
    default: return 'External Source'
  }
}

export default function ResultCard({ result }) {
  const { openAssistant } = useAI()
  const [copied, setCopied] = useState(false)
  const [whyOpen, setWhyOpen] = useState(true)

  const v = VERDICTS[result.verdict] || VERDICTS['Needs Verification']
  const SourceIcon = SOURCE_ICON[result.source_type] || Type
  const isUrl = result.source_type === 'url' && /^https?:\/\//.test(result.source_ref || '')
  const hasExternalMatches =
    result.external_fact_check?.status === 'success' &&
    result.external_fact_check.matches?.length > 0

  const matches = result.external_fact_check?.matches || []
  const isQuestion = result.input_type === 'question'
  const isShortInput = result.input_type === 'short_input'

  const words = (result.influential_words || []).map((w) => ({
    word: w.word,
    value: w.weight,
  }))

  const handleCopy = () => {
    const textToCopy = [
      `TruthLens AI — Verification Report`,
      `Title / Claim: ${result.title}`,
      `Status: ${result.verification_status || result.verdict}`,
      `Conclusion: ${result.final_conclusion || result.verification_reason}`,
      `Model Assessment: ${result.model_prediction || 'N/A'} (Confidence: ${result.confidence_display || 'N/A'})`,
      `Last Verified: ${fmtDate(result.last_verified || result.created_at || new Date().toISOString())}`,
      `Verification Link: http://localhost:5173`,
    ].join('\n')

    navigator.clipboard?.writeText(textToCopy).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleReset = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => {
      const inputEl = document.querySelector('textarea') || document.querySelector('input[type="text"]')
      if (inputEl) inputEl.focus()
    }, 200)
  }

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
      confidence: result.confidence_display || pct(result.confidence, 1),
      confidence_display: result.confidence_display,
      verification_status: result.verification_status || 'Needs Verification',
      verification_summary: result.verification_summary,
      verification_reason: result.verification_reason,
      final_conclusion: result.final_conclusion,
      external_evidence: result.external_evidence,
      indicators: result.suspicious_flags?.map((f) => `${f.label} (${f.count}x)`),
      explanation: Array.isArray(result.explanation) ? result.explanation.join('; ') : result.explanation,
      snippet: result.snippet || result.text?.slice(0, 500),
      text: result.text,
      word_count: result.word_count,
      external_fact_check: result.external_fact_check,
      input_type: result.input_type,
      id: result.id,
    })
  }

  // -------------------------------------------------------------------------
  // CASE 1: SHORT / LOW-CONTEXT INPUT
  // -------------------------------------------------------------------------
  if (isShortInput) {
    return (
      <div className="animate-fade-up space-y-6">
        <div className="glass p-6 sm:p-8 relative overflow-hidden shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/[0.08] pb-5">
            <div className="flex items-center gap-2.5">
              <VerdictBadge verdict="Insufficient Context" large />
              <span className="text-xs font-mono text-slate-400">Diagnostic ID #{result.id || 'live'}</span>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Last verified: {fmtDate(result.last_verified || result.created_at || new Date().toISOString())}
            </span>
          </div>

          <div className="mt-6 space-y-3">
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              “{result.title}”
            </h2>
            <div className="flex items-start gap-3 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100/80 dark:bg-white/[0.03] p-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <Info className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Insufficient Context</p>
                <p className="mt-1">{result.verification_reason || 'Please provide the complete claim or article for reliable analysis.'}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-slate-200/80 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={handleReset}
              className="btn-primary !py-2 !px-4 text-xs flex items-center gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Analyze Another Claim</span>
            </button>
            <button
              type="button"
              onClick={handleAskAI}
              className="btn-ghost !py-2 !px-4 text-xs flex items-center gap-2 border border-slate-300 dark:border-white/10"
            >
              <Bot className="h-3.5 w-3.5 text-violet-500" />
              <span>Ask AI Assistant</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // CASE 2: FACTUAL QUESTION / CURRENT-EVENT CLAIM
  // -------------------------------------------------------------------------
  if (isQuestion) {
    return (
      <div className="animate-fade-up space-y-6">
        {/* TOP LEVEL: FACT VERIFICATION CARD */}
        <div className="glass p-6 sm:p-8 relative overflow-hidden shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-white/[0.08] pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2.5 py-0.5 rounded-full border border-violet-500/20">
                Fact Verification
              </span>
              <VerdictBadge verdict={result.verification_status || 'Needs Verification'} large />
              {result.evidence_strength && result.evidence_strength !== 'None' && (
                <span className="rounded-full bg-violet-500/15 border border-violet-500/30 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
                  Evidence Strength: {result.evidence_strength}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
              <span>Last verified: {fmtDate(result.last_verified || result.created_at || new Date().toISOString())}</span>
              <span>·</span>
              <span>#{result.id || 'live'}</span>
            </div>
          </div>

          <h2 className="mt-5 break-words font-display text-2xl sm:text-3xl font-extrabold leading-snug text-slate-900 dark:text-white">
            “{result.title}”
          </h2>

          {/* Short Final Conclusion */}
          <div className="mt-5 rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-950/40 via-indigo-950/30 to-purple-950/40 p-5 shadow-lg backdrop-blur-sm">
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/40">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider font-bold text-violet-400">
                  Final Conclusion
                </span>
                <p className="mt-1 text-sm sm:text-base font-bold leading-relaxed text-slate-100">
                  {result.final_conclusion || result.verification_reason}
                </p>
              </div>
            </div>
          </div>

          {/* Correct Verification Disclaimer (No Contradictory Warning) */}
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <p className="font-semibold">
                {result.verification_notice || (hasExternalMatches
                  ? 'TruthLens found matching external fact-check evidence relevant to this claim.'
                  : 'TruthLens could not find sufficient reliable external evidence to determine this claim.')}
              </p>
              <p className="mt-0.5 text-[11px] opacity-90">
                {result.disclaimer || 'Verification is based on available external fact-check evidence, not the ML writing-pattern classifier.'}
              </p>
            </div>
          </div>

          {/* User Actions Bar */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200/80 dark:border-white/[0.08]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="btn-ghost !py-2 !px-3.5 text-xs flex items-center gap-1.5 border border-slate-200 dark:border-white/10"
                aria-label="Copy Result"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Result'}</span>
              </button>

              <button
                type="button"
                onClick={handleAskAI}
                className="btn-primary !py-2 !px-3.5 text-xs flex items-center gap-1.5 shadow-md shadow-violet-500/20"
                aria-label="Ask AI"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Ask AI to Explain</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="btn-ghost !py-2 !px-3.5 text-xs flex items-center gap-1.5 border border-slate-200 dark:border-white/10"
                aria-label="Analyze Another Claim"
              >
                <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                <span>Analyze Another Claim</span>
              </button>
            </div>

            {isUrl && (
              <a
                href={result.source_ref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-400 underline"
              >
                <span>View Source</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* SECTION 2: EXTERNAL EVIDENCE */}
        <Section
          title="External Evidence"
          badge={
            (result.evidence_items?.length)
              ? `${result.evidence_items.length} verified source(s)`
              : (hasExternalMatches ? `${matches.length} matching report(s)` : 'Evidence Check')
          }
        >
          {/* AI Grounded Assessment Callout */}
          {result.ai_assessment && (
            <div className="mb-4 rounded-xl border border-violet-500/30 bg-violet-500/[0.05] p-4 text-xs sm:text-sm">
              <div className="flex items-center gap-2 font-bold text-violet-600 dark:text-violet-400 mb-1">
                <Sparkles className="h-4 w-4" />
                <span>AI Grounded Assessment</span>
              </div>
              <p className="text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                {result.ai_assessment}
              </p>
              {result.missing_evidence_note && (
                <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 font-mono">
                  Verification Note: {result.missing_evidence_note}
                </p>
              )}
            </div>
          )}

          {result.evidence_items?.length ? (
            <div className="space-y-3.5">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                TruthLens retrieved the following authoritative sources to verify this claim:
              </p>
              {result.evidence_items.map((ev, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/60 dark:border-white/[0.08] dark:bg-white/[0.02] p-4 sm:p-5 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {ev.source_name}
                      </span>
                      <span className="rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                        {getSourceTypeLabel(ev.source_type)}
                      </span>
                      {ev.rating && (
                        <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                          {ev.rating}
                        </span>
                      )}
                    </div>
                    {ev.provenance && (
                      <span className="text-[10px] font-mono text-slate-400">
                        {ev.provenance}
                      </span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                    {ev.snippet}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-white/[0.06] text-xs">
                    <span className="text-slate-400 text-[11px] font-mono">
                      Relevance: {ev.relevance || 'High'} · Strength: {ev.evidence_strength || 'Strong'}
                    </span>
                    {ev.source_url && (
                      <a
                        href={ev.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-bold text-violet-600 hover:text-violet-400 transition-colors"
                      >
                        <span>View Original Source</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : hasExternalMatches ? (
            <div className="space-y-3.5">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                TruthLens located independent fact-check reports addressing this specific inquiry or claim:
              </p>
              {matches.map((claim, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/60 dark:border-white/[0.08] dark:bg-white/[0.02] p-4 sm:p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {claim.reviews?.[0]?.publisher || 'Independent Fact-Checker'}
                      </span>
                      {claim.reviews?.[0]?.rating && (
                        <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                          Rating: {claim.reviews[0].rating}
                        </span>
                      )}
                    </div>
                    {claim.reviews?.[0]?.review_date && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        Published: {claim.reviews[0].review_date.slice(0, 10)}
                      </span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 italic border-l-2 border-violet-500/40 pl-3">
                    “{claim.claim}”
                  </p>

                  {claim.reviews?.[0]?.title && claim.reviews[0].title !== 'Fact Review' && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {claim.reviews[0].title}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-white/[0.06] text-xs">
                    <span className="text-slate-400 text-[11px] font-mono">
                      {claim.claimant ? `Claimant: ${claim.claimant}` : 'Fact review'}
                    </span>
                    {claim.reviews?.[0]?.url && (
                      <a
                        href={claim.reviews[0].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-bold text-violet-600 hover:text-violet-400 transition-colors"
                      >
                        <span>Open Source</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02] p-6 text-center">
              <Search className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2.5 text-sm font-bold text-slate-800 dark:text-slate-200">
                No matching external fact-check was found.
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                No reliable external evidence was found to determine this claim. TruthLens found no published claim review in indexed fact-checking databases for this query. The status remains Needs Verification.
              </p>
            </div>
          )}
        </Section>

        {/* SECTION 3: MODEL ANALYSIS (Clearly distinguished) */}
        <Section title="Model Analysis" badge="Linguistic Engine">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] p-4 bg-slate-50/50 dark:bg-white/[0.02]">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-400">
                Classification Type
              </span>
              <div className="mt-2 flex items-center gap-2">
                <VerdictBadge verdict="Factual Question / Claim" />
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Inquiry detected rather than news article writing patterns.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] p-4 bg-slate-50/50 dark:bg-white/[0.02]">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-400">
                ML Confidence
              </span>
              <div className="mt-1 text-2xl font-extrabold text-slate-700 dark:text-slate-300 font-display">
                N/A (Question)
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Linguistic style modeling is not applicable to factual verification.
              </p>
            </div>
          </div>
        </Section>

        {/* SECTION 4: WHY THIS VERDICT? (Expandable) */}
        <Section title="Diagnostic Breakdown" badge="Transparency">
          <div className="border border-slate-200/80 dark:border-white/[0.08] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setWhyOpen(!whyOpen)}
              className="w-full flex items-center justify-between p-4 bg-slate-50/80 dark:bg-white/[0.03] text-left transition hover:bg-slate-100 dark:hover:bg-white/[0.05]"
            >
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-violet-500" />
                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                  Why this verdict? ({result.verification_status || 'Needs Verification'})
                </span>
              </div>
              {whyOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>

            {whyOpen && (
              <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-white/[0.08] space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                <p>
                  <strong className="font-bold text-slate-900 dark:text-white">1. Input Identification: </strong>
                  This query was identified as a factual inquiry rather than a standard published news article.
                </p>
                <p>
                  <strong className="font-bold text-slate-900 dark:text-white">2. ML Classification Separation: </strong>
                  The machine-learning classifier evaluates rhetorical syntax and sensationalism, which does not prove or disprove real-world events. Therefore, ML confidence is marked N/A.
                </p>
                <p>
                  <strong className="font-bold text-slate-900 dark:text-white">3. Factual Determination: </strong>
                  {hasExternalMatches
                    ? `Status '${result.verification_status}' was determined directly from ${matches.length} matching published fact-check review(s).`
                    : "No published fact-check entries were located for this specific inquiry. By standard TruthLens methodology, absence of evidence defaults to 'Needs Verification' rather than 'False'."}
                </p>
              </div>
            )}
          </div>
        </Section>

        {/* SECTION 5: TRUTHLENS AI ASSISTANT BANNER */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-600/15 via-indigo-600/10 to-fuchsia-600/10 p-5 shadow-inner">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-600/20 text-violet-400 ring-1 ring-violet-500/30">
              <Bot className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                TruthLens AI Assistant
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Want deeper details on this claim or guidance on verifying current news?
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

        {/* SECTION 6: CROSS-VERIFICATION DIRECT SEARCH */}
        <Section title="Direct Fact-Checker Search" badge="Cross-Verification">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Cross-check this claim directly with accredited independent journalism databases:
          </p>
          <ul className="grid sm:grid-cols-2 gap-2.5">
            {(result.fact_check_links || []).map((l) => (
              <li key={l.name}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 p-3 text-xs transition-all hover:border-violet-400 hover:bg-violet-500/[0.04] dark:border-white/[0.08]"
                >
                  <div>
                    <span className="block font-bold text-slate-800 dark:text-slate-100 group-hover:text-violet-500 transition-colors">
                      {l.name}
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                      {l.note}
                    </span>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-violet-500 transition-transform" />
                </a>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // CASE 3: STANDARD NEWS ARTICLE / ML PIPELINE
  // -------------------------------------------------------------------------
  return (
    <div className="animate-fade-up space-y-6">
      {/* Primary Diagnostic Summary Banner */}
      <div className="glass p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col items-center gap-7 sm:flex-row">
          <Ring value={result.confidence} displayValue={result.confidence_display} color={v.color} />

          <div className="w-full min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <VerdictBadge verdict={result.model_prediction || result.verdict} large />
                <span className="group relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-500/10 px-3.5 py-1 text-xs sm:text-sm font-semibold text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300 cursor-help">
                  <ShieldQuestion className="h-4 w-4 text-amber-500" />
                  <span>{result.verification_status || 'Needs Verification'}</span>
                  <Info className="h-3 w-3 text-amber-500/80" />
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 rounded-xl bg-slate-900/95 border border-slate-700 px-3 py-2 text-[11px] font-normal text-slate-200 opacity-0 shadow-2xl transition-opacity group-hover:opacity-100 z-50 text-center leading-snug">
                    Needs Verification does not mean False. It means reliable evidence was not sufficient to determine the claim.
                  </span>
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Diagnostic ID #{result.id || 'live'}
              </span>
            </div>

            <h2 className="mt-3.5 break-words font-display text-xl sm:text-2xl font-bold leading-snug text-slate-900 dark:text-white">
              {result.title}
            </h2>

            {/* Final User-Facing Conclusion Banner */}
            <div className="mt-4 rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-950/40 via-indigo-950/30 to-purple-950/40 p-4 shadow-md backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/40">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider font-bold text-violet-400">
                      5. Final User-Facing Conclusion
                    </span>
                    <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-violet-300 ring-1 ring-violet-500/30">
                      Synthesized Assessment
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm font-semibold leading-relaxed text-slate-100">
                    {result.final_conclusion || result.verification_reason}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
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
              <span>·</span>
              <span>Last verified: {fmtDate(result.last_verified || result.created_at || new Date().toISOString())}</span>
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
            {result.verification_notice && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-3.5 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                <p>
                  <strong className="font-bold">Verification Notice: </strong>
                  {result.verification_notice}
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

        {/* User Actions Bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200/80 dark:border-white/[0.08]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="btn-ghost !py-2 !px-3.5 text-xs flex items-center gap-1.5 border border-slate-200 dark:border-white/10"
              aria-label="Copy Result"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Result'}</span>
            </button>

            <button
              type="button"
              onClick={handleAskAI}
              className="btn-primary !py-2 !px-3.5 text-xs flex items-center gap-1.5 shadow-md shadow-violet-500/20"
              aria-label="Ask AI"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Ask AI to Explain</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="btn-ghost !py-2 !px-3.5 text-xs flex items-center gap-1.5 border border-slate-200 dark:border-white/10"
              aria-label="Analyze Another Claim"
            >
              <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
              <span>Analyze Another Claim</span>
            </button>
          </div>

          {isUrl && (
            <a
              href={result.source_ref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-400 underline"
            >
              <span>View Source</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
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
            {result.confidence_display || pct(result.confidence, 1)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Statistical pattern match certainty
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            3. Fact Verification Status
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <VerdictBadge verdict={result.verification_status || 'Needs Verification'} />
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Independent factual evidence
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            4. External Evidence
          </div>
          <div className="mt-1 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
            {hasExternalMatches ? (
              <span className="text-violet-600 dark:text-violet-400">
                {matches.length} Matches Found
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">
                {result.external_evidence || 'No Fact-Check Matches'}
              </span>
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

      {/* External Verified Matches (Multi-Source Authoritative Evidence & Fact Checks) */}
      <Section
        title="Authoritative External Evidence & Fact-Checks"
        badge={
          (result.evidence_items?.length)
            ? `${result.evidence_items.length} verified source(s)`
            : (hasExternalMatches ? `${matches.length} matches` : 'External Evidence')
        }
      >
        {result.evidence_items?.length ? (
          <div className="space-y-3">
            {result.evidence_items.map((ev, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-4 text-xs sm:text-sm space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {ev.source_name}
                    </span>
                    <span className="rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                      {getSourceTypeLabel(ev.source_type)}
                    </span>
                    {ev.rating && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300 font-bold">
                        Rating: {ev.rating}
                      </span>
                    )}
                  </div>
                  {ev.provenance && (
                    <span className="text-[10px] font-mono text-slate-400">
                      {ev.provenance}
                    </span>
                  )}
                </div>
                <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-xs">
                  {ev.snippet}
                </p>
                <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-white/[0.06] pt-2 text-xs">
                  <span className="text-slate-400 text-[11px] font-mono">
                    Relevance: {ev.relevance || 'High'} · Strength: {ev.evidence_strength || 'Moderate'}
                  </span>
                  {ev.source_url && (
                    <a
                      href={ev.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-violet-600 hover:text-violet-400 underline"
                    >
                      View Original Source <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : hasExternalMatches ? (
          <div className="space-y-3">
            {matches.map((claim, idx) => (
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
        ) : (
          <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02] p-5 text-center">
            <Search className="mx-auto h-7 w-7 text-slate-400" />
            <p className="mt-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
              No matching external fact-check was found.
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              No published claim review was located in indexed fact-checking databases for this specific query.
              Linguistic pattern analysis alone cannot verify empirical claims; check independent sources below.
            </p>
          </div>
        )}
      </Section>

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
