import { VERDICTS } from '../constants'

export default function VerdictBadge({ verdict, large = false }) {
  const v = VERDICTS[verdict] || VERDICTS['Needs Verification']
  const Icon = v.icon
  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full font-semibold ring-1 shadow-sm transition-all ${v.badge} ${
        large ? 'px-4 py-1.5 text-sm sm:text-base font-bold shadow-md' : 'px-3 py-1 text-xs'
      }`}
    >
      <Icon className={large ? 'h-5 w-5' : 'h-3.5 w-3.5'} />
      <span>{verdict}</span>
    </span>
  )
}
