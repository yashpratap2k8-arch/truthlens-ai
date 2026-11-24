import { useEffect, useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  FileCheck2,
  FileUp,
  Gauge,
  Globe,
  History,
  Layers,
  ScanText,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  Zap,
} from 'lucide-react'
import { api } from '../api'
import { pct } from '../constants'

const FEATURES = [
  {
    icon: ScanText,
    title: 'Headline & Article Analysis',
    desc: 'Instantly inspect pasted headlines, press releases, or complete articles for misleading writing patterns.',
    tag: 'NLP Engine',
  },
  {
    icon: Globe,
    title: 'Automated URL Ingestion',
    desc: 'Supply any public article link. TruthLens fetches the body, extracts core paragraphs, and guards against SSRF.',
    tag: 'Web Parser',
  },
  {
    icon: FileUp,
    title: 'Drag-and-Drop Document Upload',
    desc: 'Drop raw text (.txt, .md) documents up to 1 MB for seamless batch reading without messy copy-pasting.',
    tag: 'File Support',
  },
  {
    icon: Sparkles,
    title: 'Transparent Model Explainability',
    desc: 'Inspect exact token weights and writing cues showing why the model leaned towards real or misleading.',
    tag: 'Explainable AI',
  },
  {
    icon: ShieldQuestion,
    title: 'Integrated Fact-Check Verification',
    desc: 'Direct search hooks into Google Fact Check Explorer, PolitiFact, Snopes, FactCheck.org, and BOOM.',
    tag: 'Source Discovery',
  },
  {
    icon: History,
    title: 'Personalized History & Audit',
    desc: 'Authenticated analysis history stored securely in SQLite with verdict filtering and clear-all privacy controls.',
    tag: 'Audit Trail',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Content Ingestion',
    desc: 'Submit text, article URL, or raw text file through our secure frontend proxy.',
  },
  {
    n: '02',
    title: 'Linguistic Sanitization',
    desc: 'Regex cleaning strips URLs, publisher tags, punctuation, and applies sublinear TF-IDF n-grams.',
  },
  {
    n: '03',
    title: 'Classifier Evaluation',
    desc: 'Logistic Regression pipeline evaluates token likelihood with strict uncertainty thresholds.',
  },
  {
    n: '04',
    title: 'Explainable Diagnostic',
    desc: 'Highlights influential vocabulary, detects sensationalist heuristics, and links fact-checkers.',
  },
]

function MetricCard({ icon: Icon, label, value, subtext, highlight = false }) {
  return (
    <div className="glass-card relative overflow-hidden p-6">
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-violet-500 via-indigo-500 to-fuchsia-500 opacity-60" />
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/20">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="font-display text-3xl font-extrabold sm:text-4xl text-slate-900 dark:text-white">
        {value}
      </div>
      {subtext && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
          <span>{subtext}</span>
        </p>
      )}
    </div>
  )
}

export default function Landing() {
  const [stats, setStats] = useState(null)
  const [model, setModel] = useState(null)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    Promise.allSettled([api.stats(), api.modelInfo()]).then(([s, m]) => {
      if (s.status === 'fulfilled') setStats(s.value)
      else setOffline(true)
      if (m.status === 'fulfilled') setModel(m.value)
    })
  }, [])

  return (
    <div className="space-y-28">
      {/* Hero Section */}
      <section className="animate-fade-up pt-6 text-center sm:pt-14">
        {/* Modern Pill Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-4 py-1.5 text-xs font-semibold text-violet-700 shadow-sm backdrop-blur-xl dark:text-violet-300 ring-1 ring-violet-500/20">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="tracking-wide">TruthLens AI · Explainable Misinformation Detection</span>
        </div>

        {/* Primary Headline */}
        <h1 className="mx-auto mt-6 max-w-4xl font-display text-4xl font-extrabold leading-[1.15] sm:text-6xl lg:text-7xl">
          Unmask Misinformation with{' '}
          <span className="gradient-text">Explainable AI</span>
        </h1>

        {/* Subhead */}
        <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
          TruthLens uses supervised machine learning to identify stylistic and linguistic patterns typical of misleading news. We provide transparent reasoning, token weights, and cross-reference fact-check tools.
        </p>

        {/* Action CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <a
            href="#/analyze"
            className="btn-primary group px-6 py-3.5 text-sm sm:text-base font-semibold shadow-glow-violet"
          >
            <span>Start Free Analysis</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
          <a
            href="#/dashboard"
            className="btn-secondary px-6 py-3.5 text-sm sm:text-base font-semibold"
          >
            <BarChart3 className="h-4 w-4 text-violet-500" />
            <span>Explore Dashboard</span>
          </a>
        </div>

        {/* Interactive Live Inspection Showcase Card */}
        <div className="mx-auto mt-14 max-w-3xl">
          <div className="glass-card relative overflow-hidden p-6 sm:p-7 text-left shadow-2xl">
            {/* Header with status pill */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500/20 text-violet-600 dark:text-violet-400">
                  <Zap className="h-4 w-4" />
                </span>
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                    Live Model Diagnostic Preview
                  </span>
                  <span className="block text-[11px] text-slate-400">Simulated natural language pipeline</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/30">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Likely Fake · 94.2%
                </span>
              </div>
            </div>

            {/* Simulated analyzed headline */}
            <div className="mt-4">
              <p className="font-display text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 leading-snug">
                “<span className="rounded bg-rose-500/20 px-1 text-rose-700 dark:text-rose-300 underline decoration-rose-500">SHOCKING BOMBSHELL</span>: Anonymous insiders claim secret agenda being hidden from citizens before election!”
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-700 dark:text-rose-300 font-mono">
                  sensational wording (2×)
                </span>
                <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-300 font-mono">
                  conspiracy framing (1×)
                </span>
                <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-violet-700 dark:text-violet-300 font-mono">
                  TF-IDF high fake weight
                </span>
              </div>
            </div>

            {/* Split probability bar */}
            <div className="mt-5 border-t border-slate-200/80 pt-4 dark:border-white/[0.08]">
              <div className="flex justify-between text-xs font-medium mb-1.5">
                <span className="text-emerald-600 dark:text-emerald-400">Real likeness: 5.8%</span>
                <span className="text-rose-600 dark:text-rose-400 font-semibold">Fake likeness: 94.2%</span>
              </div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <div className="bg-emerald-500 w-[5.8%]" />
                <div className="bg-gradient-to-r from-rose-500 to-red-600 w-[94.2%]" />
              </div>
            </div>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="mx-auto mt-14 grid max-w-4xl grid-cols-1 sm:grid-cols-3 gap-5">
          {offline ? (
            <div className="col-span-3 glass p-6 text-sm text-slate-500 dark:text-slate-400">
              Backend not reachable — start the API server to view real-time model accuracy &amp; metrics.
            </div>
          ) : (
            <>
              <MetricCard
                icon={Database}
                label="Articles Analyzed"
                value={stats ? stats.total.toLocaleString() : '…'}
                subtext="Logged in SQLite database"
              />
              <MetricCard
                icon={Gauge}
                label="Held-Out Accuracy"
                value={model ? pct(model.accuracy, 1) : '99.4%'}
                subtext="Tested on unseen split"
                highlight
              />
              <MetricCard
                icon={FileCheck2}
                label="Trained Articles"
                value={model ? model.n_train.toLocaleString() : '35,000+'}
                subtext="ISOT Research Dataset"
              />
            </>
          )}
        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section>
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            Core Capabilities
          </span>
          <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl text-slate-900 dark:text-white">
            Built for <span className="gradient-text">Critical Inquiry</span>
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Engineered to highlight the rhetoric and vocabulary commonly employed in deceptive content.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.title}
                className="glass-card group relative p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/20 via-indigo-500/15 to-fuchsia-500/10 text-violet-600 dark:text-violet-300 ring-1 ring-violet-500/20 transition-transform group-hover:scale-105">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:bg-white/[0.05] dark:text-slate-400">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 4-Step Pipeline Architecture */}
      <section>
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            System Workflow
          </span>
          <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl text-slate-900 dark:text-white">
            How the <span className="gradient-text">Engine Operates</span>
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            From raw input string to calibrated verdict in under 100 milliseconds.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="glass-card relative p-6">
              <span className="font-display text-4xl font-extrabold text-violet-500/40 dark:text-violet-400/30">
                {s.n}
              </span>
              <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">
                {s.title}
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Responsible AI Disclaimer Banner */}
      <section className="glass mx-auto max-w-4xl p-8 sm:p-10 text-center relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-amber-500/30 via-violet-500/50 to-emerald-500/30" />
        <span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Responsible AI &amp; Academic Integrity
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          TruthLens measures statistical resemblance to known misleading writing styles. It is designed as an educational and research aid rather than a definitive truth arbiter. When confidence is borderline or context is unfamiliar, the engine defaults to “Needs Verification”. Always cross-reference claims with established fact-checking journalists.
        </p>
      </section>
    </div>
  )
}
