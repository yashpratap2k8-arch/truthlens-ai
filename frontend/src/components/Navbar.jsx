import { useState, useRef, useEffect } from 'react'
import {
  Bot,
  ChevronDown,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Sparkles,
  Sun,
  User,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAI } from '../context/AIContext'
import GoogleSignInButton from './GoogleSignInButton'

const LINKS = [
  ['home', 'Home', Home],
  ['analyze', 'Analyze', Search],
  ['history', 'History', History],
  ['dashboard', 'Dashboard', LayoutDashboard],
]

export default function Navbar({ route, dark, onToggleTheme }) {
  const [open, setOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)
  const { user, logout } = useAuth()
  const { openAssistant } = useAI()

  useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const linkCls = (key) =>
    `relative rounded-xl px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all duration-200 ${
      route === key
        ? 'bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 shadow-sm shadow-violet-500/10 ring-1 ring-violet-500/20'
        : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
    }`

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3.5 sm:px-6">
      <nav className="mx-auto max-w-6xl rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-2.5 shadow-lg shadow-slate-900/5 backdrop-blur-2xl transition-all dark:border-white/[0.08] dark:bg-[#0a0e20]/80 dark:shadow-2xl dark:shadow-black/70 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between">
          {/* Brand Logo */}
          <a href="#/home" className="group flex items-center gap-2.5 font-display text-lg font-bold">
            <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/30 transition-transform duration-300 group-hover:scale-105">
              <Sparkles className="h-4 w-4" />
              <span className="absolute -inset-0.5 rounded-xl bg-violet-500 opacity-20 blur group-hover:opacity-40 transition-opacity" />
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-900 dark:text-white">Truth<span className="gradient-text">Lens</span></span>
              <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300">
                AI
              </span>
            </div>
          </a>

          {/* Navigation Links */}
          <div className="hidden items-center gap-1 md:flex rounded-xl bg-slate-100/60 p-1 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05]">
            {LINKS.map(([key, label, Icon]) => (
              <a key={key} href={`#/${key}`} className={linkCls(key)}>
                <span className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 opacity-80" />
                  <span>{label}</span>
                </span>
              </a>
            ))}
          </div>

          {/* Right actions: Theme, Auth, CTA */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleTheme}
              className="btn-ghost !p-2 !rounded-xl"
              aria-label="Toggle dark mode"
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
            </button>

            {/* Google Authentication / User Profile */}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-100/80 p-1 pl-2.5 text-xs font-semibold text-slate-700 transition hover:border-violet-400/60 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200 dark:hover:border-violet-500/50"
                  aria-label="User menu"
                >
                  <span className="hidden max-w-[110px] truncate sm:inline-block">
                    {user.name ? user.name.split(' ')[0] : user.email.split('@')[0]}
                  </span>
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name || 'User'}
                      referrerPolicy="no-referrer"
                      className="h-7 w-7 rounded-lg object-cover ring-2 ring-violet-500/30"
                    />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500/20 text-xs font-semibold text-violet-600 dark:text-violet-300">
                      <User className="h-4 w-4" />
                    </span>
                  )}
                  <ChevronDown className="h-3 w-3 text-slate-400 mr-0.5" />
                </button>

                {userMenuOpen && (
                  <div className="glass absolute right-0 mt-2 w-60 p-2.5 shadow-2xl animate-fade-up">
                    <div className="border-b border-slate-200/80 px-3 py-2.5 dark:border-white/[0.08]">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Authenticated</span>
                      </div>
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {user.name || 'Google User'}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {user.email}
                      </p>
                    </div>
                    <div className="pt-1.5">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false)
                          logout()
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden sm:block">
                <GoogleSignInButton dark={dark} />
              </div>
            )}

            {/* AI Assistant Button */}
            <button
              onClick={() => openAssistant()}
              className="flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-500/20 dark:text-violet-300 dark:hover:bg-violet-500/25"
              aria-label="Ask AI Assistant"
              title="Open TruthLens AI Assistant"
            >
              <Bot className="h-4 w-4 text-violet-500" />
              <span className="hidden sm:inline">Ask AI</span>
            </button>

            <a href="#/analyze" className="btn-primary hidden !py-2 text-xs sm:inline-flex">
              Analyze news
            </a>

            <button
              onClick={() => setOpen((o) => !o)}
              className="btn-ghost !p-2 !rounded-xl md:hidden"
              aria-label="Menu"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {open && (
          <div className="mt-3 flex flex-col gap-1 border-t border-slate-200/80 pt-3 md:hidden dark:border-white/[0.08] animate-fade-up">
            {LINKS.map(([key, label, Icon]) => (
              <a
                key={key}
                href={`#/${key}`}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  route === key
                    ? 'bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06]'
                }`}
              >
                <Icon className="h-4 w-4 opacity-80" />
                <span>{label}</span>
              </a>
            ))}

            <button
              onClick={() => {
                setOpen(false)
                openAssistant()
              }}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-violet-700 hover:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20 transition"
            >
              <Bot className="h-4 w-4 text-violet-500" />
              TruthLens AI Assistant
            </button>

            {!user ? (
              <div className="mt-2 border-t border-slate-200/80 pt-3 sm:hidden dark:border-white/[0.08]">
                <GoogleSignInButton dark={dark} />
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between border-t border-slate-200/80 pt-3 sm:hidden dark:border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 rounded-lg object-cover ring-1 ring-violet-500/40"
                    />
                  ) : (
                    <User className="h-5 w-5 text-violet-500" />
                  )}
                  <div className="text-xs">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{user.name}</p>
                    <p className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setOpen(false)
                    logout()
                  }}
                  className="btn-ghost !p-2 text-rose-500"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  )
}

