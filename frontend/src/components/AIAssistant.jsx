import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  MessageSquare,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { useAI } from '../context/AIContext'

const QUICK_PROMPTS = [
  'Why was this article marked suspicious?',
  'Explain this result in simple language',
  'What does Needs Verification mean?',
  'What does the confidence score mean?',
  'Is this prediction a verified fact?',
  'How can I verify this news independently?',
]

function renderFormattedText(text) {
  if (!text) return null
  // Simple markdown-style line renderer
  const lines = text.split('\n')
  return lines.map((line, idx) => {
    let content = line.trim()
    if (!content) return <div key={idx} className="h-2" />

    // Headers
    if (content.startsWith('### ')) {
      return (
        <h4 key={idx} className="font-bold text-sm text-slate-900 dark:text-white mt-2 mb-1">
          {content.slice(4)}
        </h4>
      )
    }
    if (content.startsWith('## ') || content.startsWith('**') && content.endsWith('**') && content.length < 60) {
      const title = content.replace(/^##\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '')
      return (
        <h3 key={idx} className="font-bold text-sm sm:text-base text-slate-900 dark:text-white mt-2.5 mb-1.5 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-500 shrink-0" />
          <span>{title}</span>
        </h3>
      )
    }

    // Bullet points
    if (content.startsWith('- ') || content.startsWith('* ')) {
      const body = content.slice(2)
      return (
        <div key={idx} className="flex items-start gap-2 text-xs sm:text-sm my-1 leading-relaxed pl-1">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500 mt-2 shrink-0" />
          <span dangerouslySetInnerHTML={{ __html: parseBold(body) }} />
        </div>
      )
    }

    // Numbered list
    if (/^\d+\.\s/.test(content)) {
      const match = content.match(/^(\d+\.)\s*(.*)$/)
      return (
        <div key={idx} className="flex items-start gap-2 text-xs sm:text-sm my-1 leading-relaxed pl-1">
          <span className="font-mono text-xs font-bold text-violet-500 shrink-0">{match[1]}</span>
          <span dangerouslySetInnerHTML={{ __html: parseBold(match[2]) }} />
        </div>
      )
    }

    return (
      <p
        key={idx}
        className="text-xs sm:text-sm my-1 leading-relaxed text-slate-700 dark:text-slate-200"
        dangerouslySetInnerHTML={{ __html: parseBold(content) }}
      />
    )
  })
}

function parseBold(str) {
  return str
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-slate-200 dark:bg-white/10 px-1 py-0.5 font-mono text-[11px]">$1</code>')
}

export default function AIAssistant() {
  const { isOpen, setIsOpen, activeContext, clearContext } = useAI()
  const { user } = useAuth()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Hello! I am your TruthLens AI Assistant. I can help explain machine-learning verdicts, clarify confidence metrics, unpack detected suspicious wording, or provide unbiased fact-checking guidance. How can I help you today?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend(promptText = null) {
    const textToSend = (promptText || input).trim()
    if (!textToSend || loading) return

    setError('')
    setInput('')

    // Append user message
    const userMsg = { role: 'user', content: textToSend }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await api.ai.chat(textToSend, activeContext)
      if (res && res.success) {
        setMessages((prev) => [...prev, { role: 'assistant', content: res.message }])
      } else {
        const errMsg = res?.message || 'The AI service returned an error. Please try again.'
        setError(errMsg)
      }
    } catch (err) {
      setError(err.message || 'Unable to connect to the AI Assistant. Please check your network.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function resetChat() {
    setMessages([
      {
        role: 'assistant',
        content:
          'Chat reset. I am ready to answer any questions about TruthLens, linguistic pattern detection, or your current analysis result.',
      },
    ])
    setError('')
  }

  return (
    <>
      {/* Floating launcher trigger pill in bottom right */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 group flex items-center gap-2.5 rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 p-3.5 pr-4 text-white shadow-xl shadow-violet-600/35 transition-all duration-300 hover:scale-105 hover:shadow-glow-violet active:scale-95"
          aria-label="Open TruthLens AI Assistant"
        >
          <span className="relative grid h-7 w-7 place-items-center rounded-full bg-white/20 text-white backdrop-blur">
            <Sparkles className="h-4 w-4 animate-pulse" />
          </span>
          <span className="font-display text-xs sm:text-sm font-bold tracking-wide">
            Ask AI Assistant
          </span>
          {activeContext && (
            <span className="h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-violet-500 animate-ping" />
          )}
        </button>
      )}

      {/* Slide-over Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-over Drawer Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full sm:max-w-md lg:max-w-lg bg-white/95 dark:bg-[#080c1d]/95 backdrop-blur-2xl border-l border-slate-200/80 dark:border-white/[0.08] shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 p-4 sm:p-5 dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  TruthLens AI Assistant
                </h2>
                <span className="rounded bg-violet-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-violet-600 dark:text-violet-400 border border-violet-500/20 uppercase">
                  free
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Explainable intelligence &amp; verification guide
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={resetChat}
              className="btn-ghost !p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              title="Reset conversation"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="btn-ghost !p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              aria-label="Close Assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Active Context Banner */}
        {activeContext && (
          <div className="flex items-center justify-between gap-2 border-b border-violet-500/20 bg-violet-500/[0.07] px-4 py-2.5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="truncate">
                <span className="font-bold text-violet-700 dark:text-violet-300">
                  {activeContext.model_prediction || activeContext.prediction || 'Analysis Context'}:
                </span>{' '}
                <span className="text-slate-700 dark:text-slate-300 truncate">
                  {activeContext.title || 'Attached'}
                </span>
                {activeContext.confidence && (
                  <span className="ml-1 text-[11px] text-slate-500 font-mono">
                    ({activeContext.confidence})
                  </span>
                )}
                {activeContext.verification_status && (
                  <span className="ml-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    {activeContext.verification_status}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={clearContext}
              className="text-[11px] text-slate-400 hover:text-violet-500 underline shrink-0 font-medium"
              title="Clear attached article context"
            >
              Detach
            </button>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.map((m, idx) => {
            const isUser = m.role === 'user'
            return (
              <div
                key={idx}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-up`}
              >
                {!isUser && (
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-300 ring-1 ring-violet-500/20 mt-1">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/20'
                      : 'border border-slate-200/80 bg-slate-50/90 text-slate-800 shadow-sm dark:border-white/[0.08] dark:bg-[#0d1226]/90 dark:text-slate-100'
                  }`}
                >
                  {isUser ? m.content : renderFormattedText(m.content)}
                </div>

                {isUser && (
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300 mt-1">
                    {user?.picture ? (
                      <img
                        src={user.picture}
                        alt="You"
                        className="h-7 w-7 rounded-lg object-cover"
                      />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Typing / Loading Indicator */}
          {loading && (
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-300 ring-1 ring-violet-500/20">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-3.5 dark:border-white/[0.08] dark:bg-[#0d1226]/90">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-violet-500 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 rounded-full bg-fuchsia-500 animate-bounce" />
                  <span className="ml-2 text-xs text-slate-400 font-mono">Analyzing with OpenRouter…</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="border-t border-slate-200/60 dark:border-white/[0.06] p-3 bg-slate-50/50 dark:bg-white/[0.01]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Suggested Queries:
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                disabled={loading}
                className="rounded-lg border border-slate-200/90 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-violet-400 hover:bg-violet-50/80 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/10 transition-colors text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="border-t border-slate-200/80 p-4 dark:border-white/[0.08] bg-white dark:bg-[#070b19]">
          <div className="relative flex items-center">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={2000}
              placeholder="Ask anything about this result or news verification..."
              className="w-full resize-none rounded-xl border border-slate-300/80 bg-slate-50 px-4 py-3 pr-12 text-xs sm:text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="absolute right-2.5 grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white transition hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none shadow-sm"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
            <span>Press Enter to send · Shift+Enter for newline</span>
            <span>{input.length}/2000</span>
          </div>
        </div>
      </div>
    </>
  )
}
