import { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import Landing from './components/Landing'
import Analyzer from './components/Analyzer'
import History from './components/History'
import Dashboard from './components/Dashboard'
import useTheme from './useTheme'
import { AuthProvider } from './context/AuthContext'
import { AIProvider } from './context/AIContext'
import AIAssistant from './components/AIAssistant'

// Tiny hash router: #/analyze, #/history, #/dashboard (anything else = home)
const ROUTES = ['home', 'analyze', 'history', 'dashboard']
const readRoute = () => {
  const r = window.location.hash.replace('#/', '')
  return ROUTES.includes(r) ? r : 'home'
}

function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Subtle radial tech grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.035] dark:opacity-[0.07]" />

      {/* Primary ambient hero glow */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[34rem] w-[50rem] rounded-full bg-gradient-to-b from-violet-600/20 via-indigo-600/15 to-transparent blur-[110px]" />

      {/* Secondary chromatic auroras */}
      <div className="absolute top-1/4 -right-32 h-[30rem] w-[30rem] animate-pulse-glow rounded-full bg-fuchsia-600/10 blur-[130px] [animation-delay:-3s]" />
      <div className="absolute top-2/3 -left-32 h-[28rem] w-[28rem] animate-pulse-glow rounded-full bg-indigo-600/10 blur-[120px] [animation-delay:-6s]" />
      <div className="absolute -bottom-32 left-1/3 h-[24rem] w-[36rem] rounded-full bg-emerald-600/5 blur-[110px]" />
    </div>
  )
}

export default function App() {
  const [route, setRoute] = useState(readRoute)
  const [dark, toggleTheme] = useTheme()

  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <AuthProvider>
      <AIProvider>
        <div className="relative min-h-screen overflow-x-hidden selection:bg-violet-500/25 selection:text-violet-900 dark:selection:text-violet-200">
          <Backdrop />
          <Navbar route={route} dark={dark} onToggleTheme={toggleTheme} />
          <main className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6">
            {route === 'home' && <Landing />}
            {route === 'analyze' && <Analyzer />}
            {route === 'history' && <History />}
            {route === 'dashboard' && <Dashboard />}
          </main>
          <AIAssistant />
          <footer className="border-t border-slate-200/80 py-8 text-center text-xs text-slate-500 dark:border-white/[0.07] dark:text-slate-400">
            <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-display text-sm font-semibold text-slate-700 dark:text-slate-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                TruthLens <span className="gradient-text font-bold">AI</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">v2.0</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400">
                Machine-learning estimates based on writing patterns. Always verify facts with trusted sources.
              </p>
              <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
                <span>TF-IDF + Logistic Regression</span>
                <span>·</span>
                <span>ISOT Dataset</span>
              </div>
            </div>
          </footer>
        </div>
      </AIProvider>
    </AuthProvider>
  )
}
