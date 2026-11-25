import { AlertTriangle, HelpCircle, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'

export const VERDICTS = {
  'Likely Real': {
    key: 'real',
    color: '#10b981',
    badge: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
    icon: ShieldCheck,
  },
  'Likely Fake': {
    key: 'fake',
    color: '#f43f5e',
    badge: 'bg-rose-500/10 text-rose-700 ring-rose-500/30 dark:text-rose-300',
    icon: ShieldAlert,
  },
  'Needs Verification': {
    key: 'review',
    color: '#f59e0b',
    badge: 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300',
    icon: ShieldQuestion,
  },
  'Uncertain / Mixed': {
    key: 'review',
    color: '#f59e0b',
    badge: 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300',
    icon: ShieldQuestion,
  },
  'Verified True': {
    key: 'real',
    color: '#10b981',
    badge: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
    icon: ShieldCheck,
  },
  'Likely True': {
    key: 'real',
    color: '#10b981',
    badge: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
    icon: ShieldCheck,
  },
  'False / Debunked': {
    key: 'fake',
    color: '#f43f5e',
    badge: 'bg-rose-500/10 text-rose-700 ring-rose-500/30 dark:text-rose-300',
    icon: ShieldAlert,
  },
  'Misleading': {
    key: 'review',
    color: '#f59e0b',
    badge: 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300',
    icon: AlertTriangle,
  },
  'Partially True': {
    key: 'review',
    color: '#f59e0b',
    badge: 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300',
    icon: ShieldQuestion,
  },
  'Insufficient Context': {
    key: 'review',
    color: '#64748b',
    badge: 'bg-slate-500/10 text-slate-700 ring-slate-500/30 dark:text-slate-300',
    icon: HelpCircle,
  },
  'Factual Question / Claim': {
    key: 'review',
    color: '#0284c7',
    badge: 'bg-sky-500/10 text-sky-700 ring-sky-500/30 dark:text-sky-300',
    icon: HelpCircle,
  },
}

export const VERDICT_ORDER = ['Likely Real', 'Needs Verification', 'Likely Fake']

export const pct = (x, digits = 1) => `${(x * 100).toFixed(digits)}%`

export const fmtDate = (iso) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
