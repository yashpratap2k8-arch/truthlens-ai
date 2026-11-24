import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart2,
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  Gauge,
  Layers,
  PieChart as PieIcon,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { api } from '../api'
import { VERDICTS, VERDICT_ORDER, fmtDate, pct } from '../constants'
import { Skeleton } from './Loader'

function Kpi({ label, value, hint, icon: Icon, badge, color = 'violet' }) {
  const colorMap = {
    violet: 'from-violet-500/20 to-indigo-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    emerald: 'from-emerald-500/20 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    rose: 'from-rose-500/20 to-pink-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    amber: 'from-amber-500/20 to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  }

  return (
    <div className="glass-card relative overflow-hidden p-5 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
        {Icon && (
          <span className={`grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br ${colorMap[color]} ring-1`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
        {value}
      </div>
      {hint && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
          {badge && <span className="font-semibold text-slate-700 dark:text-slate-300">{badge}</span>}
          <span>{hint}</span>
        </p>
      )}
    </div>
  )
}

function Card({ title, subtitle, children, className = '', icon: Icon }) {
  return (
    <section className={`glass p-6 sm:p-7 shadow-xl ${className}`}>
      <div className="flex items-center justify-between mb-5 border-b border-slate-200/80 pb-3.5 dark:border-white/[0.08]">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-violet-500" />}
            <span>{title}</span>
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [model, setModel] = useState(null)
  const [statsError, setStatsError] = useState('')
  const [modelError, setModelError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([api.stats(), api.modelInfo()]).then(([s, m]) => {
      if (s.status === 'fulfilled') setStats(s.value)
      else setStatsError(s.reason.message)
      if (m.status === 'fulfilled') setModel(m.value)
      else setModelError(m.reason.message)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 !rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 !rounded-2xl" />
      </div>
    )
  }

  const total = stats?.total ?? 0
  const pieData = stats
    ? VERDICT_ORDER.map((name) => ({ name, value: stats.verdicts[name] })).filter((d) => d.value > 0)
    : []
  const share = (name) => (total ? pct(stats.verdicts[name] / total, 0) : '—')

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200/80 pb-6 dark:border-white/[0.08]">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300 mb-2">
            <Activity className="h-3.5 w-3.5" />
            <span>Telemetry &amp; Model Observability</span>
          </div>
          <h1 className="text-3xl font-extrabold sm:text-4xl text-slate-900 dark:text-white">
            Analytics <span className="gradient-text">Dashboard</span>
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Real-time activity telemetry from saved analyses and verified machine learning performance benchmarks.
          </p>
        </div>
      </div>

      {statsError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-700 dark:text-rose-300" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
          <span>{statsError}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      {stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icon={Database}
              color="violet"
              label="Total Analyses"
              value={total.toLocaleString()}
              hint="Saved in database records"
            />
            <Kpi
              icon={Gauge}
              color="emerald"
              label="Mean Confidence"
              value={total ? pct(stats.avg_confidence, 1) : '—'}
              hint="Confidence calibration average"
            />
            <Kpi
              icon={ShieldAlert}
              color="rose"
              label="Likely Fake"
              value={share('Likely Fake')}
              hint={`${stats.verdicts['Likely Fake']} of ${total} total flags`}
            />
            <Kpi
              icon={ShieldQuestion}
              color="amber"
              label="Needs Verification"
              value={share('Needs Verification')}
              hint={`${stats.verdicts['Needs Verification']} inconclusive flags`}
            />
          </div>

          {total === 0 ? (
            <div className="glass p-12 sm:p-16 text-center shadow-2xl">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/20">
                <BarChart2 className="h-7 w-7" />
              </div>
              <p className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                No Analytics Telemetry Recorded Yet
              </p>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Interactive distribution charts and activity timelines will populate automatically once you submit your first article for analysis.
              </p>
              <a href="#/analyze" className="btn-primary mt-6 text-xs sm:text-sm">
                <Sparkles className="h-4 w-4" />
                <span>Run Your First Analysis</span>
              </a>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Pie Chart: Results Breakdown */}
              <Card
                title="Verdict Distribution"
                subtitle="Relative proportions of classified articles"
                icon={PieIcon}
              >
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={65}
                        outerRadius={100}
                        paddingAngle={4}
                        stroke="none"
                      >
                        {pieData.map((d) => (
                          <Cell key={d.name} fill={VERDICTS[d.name].color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0c1022',
                          borderRadius: 12,
                          borderColor: 'rgba(255,255,255,0.1)',
                          color: '#f8fafc',
                          fontSize: 12,
                          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Bar Chart: Daily Activity */}
              <Card
                title="Analysis Frequency Timeline"
                subtitle="Daily submissions over the last 14 days (UTC)"
                icon={TrendingUp}
              >
                <div className="h-72 text-slate-500 dark:text-slate-400">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.daily}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="currentColor"
                        strokeOpacity={0.08}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        tickFormatter={(d) => d.slice(5)}
                        tick={{ fill: 'currentColor', fontSize: 11, fontFamily: 'monospace' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: 'currentColor', fontSize: 11, fontFamily: 'monospace' }}
                        axisLine={false}
                        tickLine={false}
                        width={28}
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
                      />
                      <Legend
                        verticalAlign="bottom"
                        wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                      />
                      <Bar
                        dataKey="real"
                        name="Likely Real"
                        stackId="a"
                        fill={VERDICTS['Likely Real'].color}
                      />
                      <Bar
                        dataKey="review"
                        name="Needs Verification"
                        stackId="a"
                        fill={VERDICTS['Needs Verification'].color}
                      />
                      <Bar
                        dataKey="fake"
                        name="Likely Fake"
                        stackId="a"
                        fill={VERDICTS['Likely Fake'].color}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Input Sources Breakdown */}
              <Card
                title="Input Vector Distribution"
                subtitle="Breakdown of submitted content ingestion formats"
                icon={Layers}
                className="lg:col-span-2"
              >
                <div className="grid gap-6 sm:grid-cols-3">
                  {[
                    ['text', 'Pasted Raw Text', 'Headlines & articles'],
                    ['url', 'Scraped Web URLs', 'Live article links'],
                    ['file', 'Uploaded Documents', '.txt & .md plain text'],
                  ].map(([k, label, desc]) => {
                    const count = stats.sources[k] || 0
                    const percentage = total ? pct(count / total, 1) : '0%'
                    return (
                      <div key={k} className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 dark:border-white/[0.05] dark:bg-white/[0.02]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                            {label}
                          </span>
                          <span className="font-mono text-xs font-bold text-violet-600 dark:text-violet-400">
                            {count} ({percentage})
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mb-2.5">{desc}</p>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-fuchsia-500 transition-all duration-700"
                            style={{ width: total ? pct(count / total, 1) : '0%' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Model Performance & Architecture Details */}
      <Card
        title="Model Architecture &amp; Test Benchmark"
        subtitle="Evaluated on 20% held-out test split of the ISOT research dataset"
        icon={Cpu}
      >
        {model ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-mono">
              <span className="font-bold text-slate-800 dark:text-slate-100">Specification:</span>{' '}
              {model.algorithm} with sublinear TF-IDF (1–2 n-grams, {model.n_features?.toLocaleString()} vocabulary features) trained on {model.n_train?.toLocaleString()} records and evaluated on {model.n_test?.toLocaleString()} held-out test records on {fmtDate(model.trained_at)}.
            </div>

            {/* Model Metric KPIs */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                ['Accuracy', model.accuracy, 'Overall correct rate'],
                ['Precision', model.precision, 'True positives ratio'],
                ['Recall', model.recall, 'Sensitivity coverage'],
                ['F1-Score', model.f1, 'Harmonic mean balance'],
              ].map(([k, v, desc]) => (
                <div key={k} className="glass-card p-4 sm:p-5">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                    {k}
                  </span>
                  <div className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                    {pct(v, 2)}
                  </div>
                  <span className="mt-1 block text-[10px] text-slate-400 font-mono">{desc}</span>
                </div>
              ))}
            </div>

            {/* Confusion Matrix and Top Vocabulary Association */}
            <div className="grid gap-6 lg:grid-cols-2 pt-2">
              <div className="rounded-xl border border-slate-200/80 p-5 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Confusion Matrix (Held-out Test Set)</span>
                </h4>
                <div className="grid max-w-sm grid-cols-[auto_1fr_1fr] gap-2 text-center text-xs">
                  <span />
                  <span className="text-[11px] font-mono text-slate-400 font-semibold">Predicted Real</span>
                  <span className="text-[11px] font-mono text-slate-400 font-semibold">Predicted Fake</span>
                  {['Actual Real', 'Actual Fake'].map((label, r) => (
                    <div key={label} className="contents">
                      <span className="self-center pr-2 text-right text-[11px] font-mono text-slate-400 font-medium">
                        {label}
                      </span>
                      {[0, 1].map((c) => {
                        const isCorrect = r === c
                        return (
                          <span
                            key={c}
                            className={`rounded-xl p-3 font-mono font-bold text-sm sm:text-base border ${
                              isCorrect
                                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            {model.confusion_matrix[r][c]?.toLocaleString()}
                          </span>
                        )
                      })}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-slate-400">
                  Diagonal elements represent true positive &amp; true negative classifications.
                </p>
              </div>

              {/* Top Term Associations */}
              <div className="space-y-4">
                {[
                  [
                    'Top Terms Associated with Fake News',
                    model.top_fake_terms,
                    'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300',
                  ],
                  [
                    'Top Terms Associated with Real News',
                    model.top_real_terms,
                    'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                  ],
                ].map(([title, terms, cls]) => (
                  <div key={title} className="rounded-xl border border-slate-200/80 p-4 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {title}
                    </h4>
                    <div className="flex flex-wrap gap-1.5 font-mono">
                      {terms.map((t) => (
                        <span
                          key={t}
                          className={`rounded-lg border px-2.5 py-0.5 text-xs font-medium ${cls}`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Caveat alert */}
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p>
                <strong>Methodological Note:</strong> High accuracy on held-out test sets reflects source consistency in the ISOT political corpus (2016–2017). Linguistic classifiers reflect style rather than ground truth facts. External validation via third-party fact-checkers is always strongly recommended for real-world breaking news.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span>{modelError || 'Model performance telemetry is not available yet.'}</span>
          </div>
        )}
      </Card>
    </div>
  )
}
