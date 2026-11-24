import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  FileUp,
  Globe,
  Link2,
  RotateCcw,
  Search,
  Sparkles,
  Type,
  UploadCloud,
  X,
} from 'lucide-react'
import { api } from '../api'
import Loader from './Loader'
import ResultCard from './ResultCard'

const MAX_FILE = 1024 * 1024
const MODES = [
  { key: 'text', label: 'Paste Text', icon: Type, desc: 'Analyze raw text or headline' },
  { key: 'url', label: 'Article URL', icon: Globe, desc: 'Extract & inspect public web page' },
  { key: 'file', label: 'Upload File', icon: FileUp, desc: 'Drop plain .txt document' },
]

const SAMPLES = [
  {
    label: 'Neutral News Wire',
    tag: 'Wire style',
    text: 'The central bank said on Tuesday it would keep its benchmark interest rate unchanged, citing slowing inflation and steady employment figures. The governor told reporters that policymakers would continue to monitor economic data before deciding on any future adjustment, according to a statement released after the two-day meeting.',
  },
  {
    label: 'Sensational / Urgent',
    tag: 'Sensational',
    text: "SHOCKING!!! You won't believe what the mainstream media is hiding from you about this secret plan. Insiders EXPOSE the cover-up and nobody is talking about it. Share this before it gets deleted — wake up, people!",
  },
  {
    label: 'Conspiracy Framing',
    tag: 'Conspiracy',
    text: "Top scientists were SILENCED when they tried to reveal the hidden truth. Deep state operatives are executing a guaranteed secret agenda. Spread the word now before they take this report down completely!",
  },
]

export default function Analyzer() {
  const [mode, setMode] = useState('text')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const fileInput = useRef(null)
  const resultRef = useRef(null)

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const chars = text.length

  function pickFile(f) {
    setError('')
    if (!f) return
    if (!/\.(txt|md)$/i.test(f.name)) return setError('Only .txt or .md plain text files are supported.')
    if (f.size > MAX_FILE) return setError('That file is too large (1 MB limit).')
    if (f.size === 0) return setError('The selected file is empty.')
    setFile(f)
  }

  function submit(e) {
    e.preventDefault()
    setError('')
    let call
    if (mode === 'text') {
      if (!text.trim()) return setError('Please enter or paste a headline or article text.')
      call = () => api.analyzeText(text)
    } else if (mode === 'url') {
      if (!url.trim()) return setError('Please enter a valid article URL.')
      call = () => api.analyzeUrl(url)
    } else {
      if (!file) return setError('Please select or drop a .txt file.')
      call = () => api.analyzeFile(file)
    }

    setResult(null)
    setLoading(true)
    call()
      .then(setResult)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  const steps = [
    ...(mode === 'url' ? ['Validating URL & applying security checks…', 'Extracting article body paragraphs & metadata…'] : []),
    ...(mode === 'file' ? ['Reading uploaded text buffer & decoding content…'] : []),
    'Sanitizing text & stripping publisher tags…',
    'Generating sublinear TF-IDF n-gram vectors…',
    'Running calibrated Logistic Regression model…',
    'Detecting rhetoric heuristics & style signals…',
    'Querying external fact-check databases…',
    'Synthesizing diagnostic credibility report…',
  ]

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3.5 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          <span>Real-time Neural Linguistic Analysis</span>
        </div>
        <h1 className="text-3xl font-extrabold sm:text-5xl text-slate-900 dark:text-white">
          Analyze News <span className="gradient-text">Credibility</span>
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
          Paste text, provide an article link, or upload a document to examine linguistic patterns and influential terms.
        </p>
      </div>

      {/* Main Analysis Form Card */}
      <form onSubmit={submit} className="glass mx-auto max-w-3xl p-6 sm:p-8 shadow-2xl relative">
        {/* Mode Selector Tabs */}
        <div className="mb-6 grid grid-cols-3 gap-2 rounded-xl bg-slate-100/80 p-1.5 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06]" role="tablist">
          {MODES.map((m) => {
            const Icon = m.icon
            const active = mode === m.key
            return (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setMode(m.key)
                  setError('')
                }}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-xs sm:text-sm font-semibold transition-all duration-200 ${
                  active
                    ? 'bg-white text-slate-900 shadow-md dark:bg-slate-800 dark:text-white dark:shadow-black/40 ring-1 ring-slate-200 dark:ring-white/10'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-white/[0.02]'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-violet-600 dark:text-violet-400' : ''}`} />
                <span className="hidden sm:inline">{m.label}</span>
                <span className="sm:hidden">{m.label.split(' ')[0]}</span>
              </button>
            )
          })}
        </div>

        {/* Mode 1: Text Input */}
        {mode === 'text' && (
          <div className="space-y-3">
            <div className="relative">
              <textarea
                className="input min-h-[220px] resize-y leading-relaxed font-sans text-sm focus:ring-violet-500/20"
                placeholder="Paste news headline or full article content here to inspect..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              {text && (
                <button
                  type="button"
                  onClick={() => setText('')}
                  className="absolute top-3 right-3 rounded-lg p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200 transition"
                  title="Clear text"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Counter and Sample Chips */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10">
                  {words} words
                </span>
                <span className="text-slate-400">·</span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10">
                  {chars} chars
                </span>
              </div>

              {/* Preset Sample Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-semibold mr-1">Load sample:</span>
                {SAMPLES.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setText(s.text)}
                    className="rounded-lg border border-slate-200/80 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-violet-400 hover:bg-violet-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-violet-500/50 dark:hover:bg-violet-500/10 transition-colors"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mode 2: URL Input */}
        {mode === 'url' && (
          <div className="space-y-3">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Globe className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="url"
                className="input pl-10"
                placeholder="https://news-website.com/article/headline"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Tip:</span> We extract the headline and body paragraphs using BeautifulSoup. Paywalled, JavaScript-rendered, or bot-blocked websites may fail to resolve — copy and paste their text directly instead.
            </div>
          </div>
        )}

        {/* Mode 3: File Upload */}
        {mode === 'file' && (
          <div>
            <input
              ref={fileInput}
              type="file"
              accept=".txt,.md,text/plain"
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files[0])
                e.target.value = ''
              }}
            />

            {file ? (
              <div className="flex items-center justify-between rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 dark:border-violet-500/30">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/20 text-violet-600 dark:text-violet-300">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-sm text-slate-800 dark:text-slate-100">{file.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{(file.size / 1024).toFixed(1)} KB · plain text</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="btn-ghost !p-2"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInput.current.click()}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.current.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  pickFile(e.dataTransfer.files[0])
                }}
                className={`flex cursor-pointer flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all ${
                  dragOver
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-slate-300 hover:border-violet-400 dark:border-white/15 dark:hover:border-violet-500/50'
                }`}
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                    Drag and drop a plain text document
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Supports .txt or .md (Maximum 1 MB)
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary !py-1.5 !px-3 !text-xs mt-1"
                >
                  Browse Files
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs sm:text-sm text-rose-700 dark:text-rose-300 animate-fade-up" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            <div className="flex-1 font-medium">{error}</div>
            <button type="button" onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Submit Button */}
        <div className="mt-6 flex items-center justify-between gap-4">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full shadow-glow-violet !py-3 font-semibold text-sm sm:text-base"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Running Diagnostics…</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                <span>Analyze Credibility</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Results or Loading area */}
      <div ref={resultRef} className="mx-auto mt-8 max-w-4xl scroll-mt-28">
        {loading && <Loader steps={steps} />}
        {result && !loading && <ResultCard result={result} />}
      </div>
    </div>
  )
}
