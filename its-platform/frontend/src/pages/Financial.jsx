import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { DollarSign, Route, Landmark } from 'lucide-react'
import client from '../api/client'
import DataTable from '../components/ui/DataTable'
import { useAuth } from '../hooks/useAuth'

// ── Fetchers ──────────────────────────────────────────────────────────────
const fetchRevenue = async (from, to) => {
  const res = await client.get(`/api/v1/financial/revenue?from=${from}&to=${to}`)
  return res.data ?? []
}

const fetchKmOperated = async (from, to) => {
  const res = await client.get(`/api/v1/financial/km-operated?from=${from}&to=${to}`)
  return res.data ?? []
}

const fetchSubsidies = async () => {
  const res = await client.get('/api/v1/financial/subsidies')
  return res.data?.subsidies ?? res.data ?? []
}

// ── Helpers ───────────────────────────────────────────────────────────────
function getDateRange(period) {
  const to   = new Date()
  const from = new Date()
  if (period === '7d')  from.setDate(from.getDate() - 7)
  if (period === '30d') from.setDate(from.getDate() - 30)
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  }
}

function formatBRL(v) {
  return Number(v ?? 0).toLocaleString('pt-BR', {
    style:                 'currency',
    currency:              'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
}

// ── Custom tooltips ───────────────────────────────────────────────────────
function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg p-3 text-sm shadow-lg" style={TOOLTIP_STYLE}>
      <p className="font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
        {new Date(label).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex justify-between gap-6">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-mono font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {formatBRL(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function KmTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg p-3 text-sm shadow-lg" style={TOOLTIP_STYLE}>
      <p className="font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex justify-between gap-6">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-mono font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {Number(entry.value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Subsidies table columns ────────────────────────────────────────────────
const SUBSIDY_COLUMNS = [
  { key: 'operator_name', header: 'Operator' },
  { key: 'month',         header: 'Month',
    render: (v) => v ? new Date(v + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '—' },
  { key: 'revenue',       header: 'Revenue', align: 'right',
    render: (v) => <span className="font-mono text-xs">{formatBRL(v)}</span> },
  { key: 'standard_cost', header: 'Standard Cost', align: 'right',
    render: (v) => <span className="font-mono text-xs">{formatBRL(v)}</span> },
  { key: 'subsidy',       header: 'Subsidy', align: 'right',
    render: (v) => (
      <span
        className="font-mono font-semibold text-xs"
        style={{ color: Number(v ?? 0) > 0 ? '#34D399' : '#F87171' }}
      >
        {formatBRL(v)}
      </span>
    ) },
]

// ── Period selector ───────────────────────────────────────────────────────
function PeriodSelector({ value, onChange }) {
  return (
    <div
      className="flex items-center gap-1 p-0.5 rounded-lg"
      style={{ border: '1px solid var(--color-border)' }}
    >
      {['7d', '30d'].map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 active:scale-[0.98]"
          style={{
            backgroundColor: value === p ? 'var(--color-accent)' : 'transparent',
            color:           value === p ? '#06090F' : 'var(--color-text-secondary)',
          }}
        >
          {p === '7d' ? '7 days' : '30 days'}
        </button>
      ))}
    </div>
  )
}

const OPERATOR_COLORS = ['#E8A020', '#60A5FA', '#34D399', '#A78BFA', '#F87171']
const TICK_STYLE      = { fontSize: 11, fill: 'rgba(224,234,255,0.42)', fontFamily: 'Geist, sans-serif' }
const TICK_MONO       = { fontSize: 11, fill: 'rgba(224,234,255,0.42)', fontFamily: 'Geist Mono, monospace' }
const GRID_COLOR      = 'rgba(255,255,255,0.06)'

// ── Empty chart placeholder ───────────────────────────────────────────────
function EmptyChart({ message }) {
  return (
    <div
      className="flex items-center justify-center h-48 rounded-lg"
      style={{
        backgroundColor: 'rgba(255,255,255,0.02)',
        border: '1px dashed rgba(255,255,255,0.08)',
      }}
    >
      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {message}
      </span>
    </div>
  )
}

// ── Section card ──────────────────────────────────────────────────────────
function Section({ icon: Icon, iconColor, title, subtitle, children }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} style={{ color: iconColor }} />
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
export default function Financial() {
  const { role } = useAuth()
  const isMulti   = role === 'fiscalizador' || role === 'superadmin'

  const [period, setPeriod] = useState('30d')
  const { from, to } = getDateRange(period)

  const { data: revenueData = [], isLoading: loadingRevenue } = useQuery({
    queryKey: ['revenue', from, to],
    queryFn:  () => fetchRevenue(from, to),
  })

  const { data: kmData = [], isLoading: loadingKm } = useQuery({
    queryKey: ['km-operated', from, to],
    queryFn:  () => fetchKmOperated(from, to),
  })

  const { data: subsidies = [], isLoading: loadingSubsidies } = useQuery({
    queryKey: ['subsidies'],
    queryFn:  fetchSubsidies,
  })

  const operatorKeys = (() => {
    if (!revenueData.length) return []
    return Object.keys(revenueData[0]).filter((k) => k !== 'date' && k !== 'record_date')
  })()

  const kmOperatorKeys = (() => {
    if (!kmData.length) return []
    return Object.keys(kmData[0]).filter((k) => k !== 'route_code' && k !== 'date')
  })()

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'Geist, sans-serif' }}
          >
            Financial Control
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Revenue, km operated and subsidies
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* ── Revenue LineChart ─────────────────────────────────────────── */}
      <Section
        icon={DollarSign}
        iconColor="#E8A020"
        title="Revenue by Period"
        subtitle={isMulti ? 'By operator comparison — values in BRL' : 'Daily revenue — values in BRL'}
      >
        {loadingRevenue ? (
          <div className="skeleton h-72 rounded-lg" />
        ) : revenueData.length === 0 ? (
          <EmptyChart message="No revenue data for selected period" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={revenueData} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                tick={TICK_STYLE}
                tickLine={false}
                axisLine={{ stroke: GRID_COLOR }}
              />
              <YAxis
                tickFormatter={(v) => `R$${(v / 1_000).toFixed(0)}k`}
                tick={TICK_MONO}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Geist, sans-serif', paddingTop: 8 }} />

              {operatorKeys.length > 0 ? (
                operatorKeys.map((key, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={key}
                    stroke={OPERATOR_COLORS[i % OPERATOR_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))
              ) : (
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#E8A020"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#E8A020' }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* ── Km Operated BarChart ─────────────────────────────────────── */}
      <Section
        icon={Route}
        iconColor="#60A5FA"
        title="Km Operated"
        subtitle="By route in selected period"
      >
        {loadingKm ? (
          <div className="skeleton h-64 rounded-lg" />
        ) : kmData.length === 0 ? (
          <EmptyChart message="No km data for selected period" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={kmData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis
                dataKey="route_code"
                tick={TICK_STYLE}
                tickLine={false}
                axisLine={{ stroke: GRID_COLOR }}
              />
              <YAxis
                tick={TICK_MONO}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<KmTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Geist, sans-serif', paddingTop: 8 }} />

              {kmOperatorKeys.length > 0 ? (
                kmOperatorKeys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={key}
                    fill={OPERATOR_COLORS[i % OPERATOR_COLORS.length]}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={40}
                  />
                ))
              ) : (
                <Bar
                  dataKey="km_operated"
                  name="Km operated"
                  fill="#60A5FA"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={40}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* ── Subsidies table ───────────────────────────────────────────── */}
      <Section
        icon={Landmark}
        iconColor="#34D399"
        title="Subsidies by Operator"
        subtitle="Standard cost vs. revenue — differential as subsidy"
      >
        <DataTable
          columns={SUBSIDY_COLUMNS}
          data={subsidies}
          loading={loadingSubsidies}
          emptyMessage="No subsidy data available"
        />
      </Section>
    </div>
  )
}
