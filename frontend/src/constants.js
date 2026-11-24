import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'

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
}

export const VERDICT_ORDER = ['Likely Real', 'Needs Verification', 'Likely Fake']

export const pct = (x, digits = 1) => `${(x * 100).toFixed(digits)}%`

export const fmtDate = (iso) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
