import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line,
  BarChart, Bar, Cell,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { DollarSign, Route, Landmark } from 'lucide-react'
import client from '../api/client'
import DataTable from '../components/ui/DataTable'

// ── Design system ─────────────────────────────────────────────────────────────
const PALETTE = ['#5EEAD4', '#818CF8', '#A78BFA', '#22D3EE', '#FB7185']
const GLOW    = [
  'rgba(94,234,212,0.22)',
  'rgba(129,140,248,0.22)',
  'rgba(167,139,250,0.22)',
  'rgba(34,211,238,0.22)',
  'rgba(251,113,133,0.22)',
]

// ── API fetchers ──────────────────────────────────────────────────────────────
const fetchRevenue    = (from, to) => client.get(`/api/v1/financial/revenue?from=${from}&to=${to}`).then(r => r.data ?? [])
const fetchKmOperated = (from, to) => client.get(`/api/v1/financial/km-operated?from=${from}&to=${to}`).then(r => r.data ?? [])
const fetchSubsidies  = ()         => client.get('/api/v1/financial/subsidies').then(r => r.data?.subsidies ?? r.data ?? [])
const fetchOperators  = ()         => client.get('/api/v1/operators').then(r => r.data ?? [])

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDateRange(period) {
  const to   = new Date()
  const from = new Date()
  if (period === '7d')  from.setDate(from.getDate() - 7)
  if (period === '30d') from.setDate(from.getDate() - 30)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

// Parse "YYYY-MM-DD" in local timezone (avoids UTC-shift showing wrong day)
function parseLocalDate(s) {
  const [y, m, d] = (s ?? '').split('-').map(Number)
  return new Date(y, m - 1, d)
}

function fmtDate(s) {
  if (!s) return '—'
  return parseLocalDate(s).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
}

function fmtBRL(v) {
  return Number(v ?? 0).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  })
}

function fmtKm(v) {
  return `${Number(v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km`
}

// Transform long-format rows [{record_date, revenue, operator_id}]
// to wide/pivoted format [{date, 'OpA': 40752, 'OpB': 41685}]
function pivotByDate(rows, dateKey, valueKey, groupKey, nameMap) {
  const map = new Map()
  rows.forEach(row => {
    const d    = row[dateKey]
    const name = nameMap[row[groupKey]] ?? String(row[groupKey] ?? '').slice(0, 8)
    if (!map.has(d)) map.set(d, { date: d })
    map.get(d)[name] = row[valueKey]
  })
  return Array.from(map.values()).sort((a, b) => (a.date > b.date ? 1 : -1))
}

// Aggregate long-format rows into total per group: [{name, value}]
function aggregateByGroup(rows, groupKey, valueKey, nameMap) {
  const map = new Map()
  rows.forEach(row => {
    const name = nameMap[row[groupKey]] ?? String(row[groupKey] ?? '').slice(0, 8)
    if (!map.has(name)) map.set(name, { name, value: 0 })
    map.get(name).value += (row[valueKey] ?? 0)
  })
  return Array.from(map.values())
}

// ── Axis style constants ──────────────────────────────────────────────────────
const TICK_SM   = { fontSize: 10, fill: 'rgba(224,234,255,0.22)', fontFamily: 'Geist, sans-serif' }
const TICK_MONO = { fontSize: 10, fill: 'rgba(224,234,255,0.18)', fontFamily: 'Geist Mono, monospace' }

// ── Floating card tooltip ─────────────────────────────────────────────────────
function FloatingTooltip({ active, payload, label, fmtLabel, fmtValue }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      backgroundColor: '#111827',
      border:          '1px solid rgba(255,255,255,0.08)',
      borderRadius:    16,
      padding:         '14px 16px',
      minWidth:        172,
      boxShadow:       '0 8px 40px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.04)',
    }}>
      <div style={{
        fontSize: 13, fontWeight: 600, color: 'rgba(224,234,255,0.90)',
        fontFamily: 'Geist, sans-serif', marginBottom: 10,
      }}>
        {fmtLabel ? fmtLabel(label) : label}
      </div>
      <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 10 }} />
      {payload.map((entry, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: i < payload.length - 1 ? 6 : 0,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: entry.color ?? entry.fill, flexShrink: 0, opacity: 0.85,
          }} />
          <span style={{ flex: 1, fontSize: 11, color: 'rgba(224,234,255,0.38)', fontFamily: 'Geist, sans-serif' }}>
            {entry.name}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(224,234,255,0.90)', fontFamily: 'Geist Mono, monospace' }}>
            {fmtValue ? fmtValue(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Inline legend ─────────────────────────────────────────────────────────────
function InlineLegend({ keys }) {
  if (!keys.length) return null
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
      {keys.map((key, i) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 14, height: 2, borderRadius: 1, backgroundColor: PALETTE[i % PALETTE.length], opacity: 0.85 }} />
          <span style={{ fontSize: 11, color: 'rgba(224,234,255,0.32)', fontFamily: 'Geist, sans-serif' }}>{key}</span>
        </div>
      ))}
    </div>
  )
}

// ── Period selector ───────────────────────────────────────────────────────────
function PeriodSelector({ value, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 2, padding: 3,
      backgroundColor: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10,
    }}>
      {['7d', '30d'].map((p) => (
        <button key={p} onClick={() => onChange(p)} style={{
          padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500,
          fontFamily: 'Geist, sans-serif', border: 'none', cursor: 'pointer',
          transition: 'all 180ms ease',
          backgroundColor: value === p ? 'rgba(255,255,255,0.08)' : 'transparent',
          color:           value === p ? 'rgba(224,234,255,0.90)' : 'rgba(224,234,255,0.38)',
        }}>
          {p === '7d' ? '7 days' : '30 days'}
        </button>
      ))}
    </div>
  )
}

// ── Chart card ────────────────────────────────────────────────────────────────
function ChartCard({ icon: Icon, iconColor, title, subtitle, children }) {
  return (
    <div style={{
      backgroundColor: 'rgba(255,255,255,0.02)',
      border:          '1px solid rgba(255,255,255,0.06)',
      borderRadius:    18,
      overflow:        'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '18px 22px 14px' }}>
        <Icon size={15} strokeWidth={1.7} style={{ color: iconColor, flexShrink: 0, marginTop: 2 }} />
        <div>
          <h2 style={{
            margin: 0, fontSize: 14, fontWeight: 600,
            color: 'rgba(224,234,255,0.92)', fontFamily: 'Geist, sans-serif', letterSpacing: '-0.01em',
          }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(224,234,255,0.35)', fontFamily: 'Geist, sans-serif' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />
      <div style={{ padding: '18px 22px 22px' }}>
        {children}
      </div>
    </div>
  )
}

function ChartSkeleton({ h = 260 }) {
  return <div className="skeleton rounded-xl" style={{ height: h }} />
}

function EmptyChart({ message, h = 220 }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: h, borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.01)',
      border: '1px dashed rgba(255,255,255,0.06)',
    }}>
      <span style={{ fontSize: 13, color: 'rgba(224,234,255,0.22)', fontFamily: 'Geist, sans-serif' }}>
        {message}
      </span>
    </div>
  )
}

// ── Subsidies columns ─────────────────────────────────────────────────────────
const SUBSIDY_COLUMNS = [
  { key: 'operator_name', header: 'Operator' },
  { key: 'month',         header: 'Month',
    render: (v) => v ? parseLocalDate(v + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '—' },
  { key: 'revenue',       header: 'Revenue',       align: 'right',
    render: (v) => <span className="font-mono text-xs">{fmtBRL(v)}</span> },
  { key: 'standard_cost', header: 'Standard Cost', align: 'right',
    render: (v) => <span className="font-mono text-xs">{fmtBRL(v)}</span> },
  { key: 'subsidy',       header: 'Subsidy',       align: 'right',
    render: (v) => (
      <span className="font-mono font-semibold text-xs"
        style={{ color: Number(v ?? 0) > 0 ? '#4ADE80' : '#F87171' }}>
        {fmtBRL(v)}
      </span>
    ) },
]

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Financial() {
  const [period, setPeriod] = useState('30d')
  const { from, to } = getDateRange(period)

  const { data: operators = [] } = useQuery({
    queryKey:  ['operators'],
    queryFn:   fetchOperators,
    staleTime: Infinity,
  })

  // UUID → display name map, updated when operators load
  const opNameMap = useMemo(() => {
    const m = {}
    operators.forEach(op => { m[op.id] = op.name ?? op.code ?? op.id.slice(0, 8) })
    return m
  }, [operators])

  const { data: revenueRaw = [], isLoading: loadingRevenue } = useQuery({
    queryKey: ['revenue', from, to],
    queryFn:  () => fetchRevenue(from, to),
  })

  const { data: kmRaw = [], isLoading: loadingKm } = useQuery({
    queryKey: ['km-operated', from, to],
    queryFn:  () => fetchKmOperated(from, to),
  })

  const { data: subsidies = [], isLoading: loadingSubsidies } = useQuery({
    queryKey: ['subsidies'],
    queryFn:  fetchSubsidies,
  })

  // API returns flat rows {record_date, revenue/km_operated, operator_id}
  // Pivot to wide format for multi-series charts
  const revenueData  = useMemo(() => pivotByDate(revenueRaw, 'record_date', 'revenue',      'operator_id', opNameMap), [revenueRaw, opNameMap])
  const kmByOperator = useMemo(() => aggregateByGroup(kmRaw, 'operator_id',  'km_operated',                opNameMap), [kmRaw,      opNameMap])

  const revenueKeys = revenueData.length ? Object.keys(revenueData[0]).filter(k => k !== 'date') : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: 16, fontWeight: 600,
            color: 'rgba(224,234,255,0.95)', fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em',
          }}>
            Financial Control
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(224,234,255,0.35)', fontFamily: 'Geist, sans-serif' }}>
            Revenue, km operated and subsidies
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* ── Revenue — multi-operator line chart ── */}
      <ChartCard
        icon={DollarSign}
        iconColor="#5EEAD4"
        title="Revenue by Period"
        subtitle="Daily revenue by operator · values in BRL"
      >
        {loadingRevenue ? <ChartSkeleton /> : revenueData.length === 0 ? (
          <EmptyChart message="No revenue data for selected period" />
        ) : (
          <>
            <InlineLegend keys={revenueKeys} />
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={revenueData} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.035)" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={TICK_SM}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `R$${(v / 1_000).toFixed(0)}k`}
                  tick={TICK_MONO}
                  tickLine={false}
                  axisLine={false}
                  width={46}
                />
                <Tooltip
                  content={<FloatingTooltip fmtLabel={fmtDate} fmtValue={fmtBRL} />}
                  cursor={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1, strokeDasharray: '3 2' }}
                />
                {revenueKeys.map((key, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={key}
                    stroke={PALETTE[i % PALETTE.length]}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, fill: PALETTE[i % PALETTE.length], stroke: '#0D1421', strokeWidth: 2 }}
                    style={{ filter: `drop-shadow(0 0 5px ${GLOW[i % GLOW.length]})` }}
                    isAnimationActive
                    animationDuration={500}
                    animationEasing="ease-out"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </ChartCard>

      {/* ── Km operated — operator comparison bar chart ── */}
      <ChartCard
        icon={Route}
        iconColor="#818CF8"
        title="Km Operated"
        subtitle={`Total km by operator · ${period === '7d' ? 'last 7 days' : 'last 30 days'}`}
      >
        {loadingKm ? <ChartSkeleton h={220} /> : kmByOperator.length === 0 ? (
          <EmptyChart message="No km data for selected period" h={200} />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={kmByOperator} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.035)" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="name"
                tick={TICK_SM}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${(v / 1_000).toFixed(0)}k`}
                tick={TICK_MONO}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip
                content={<FloatingTooltip fmtValue={fmtKm} />}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar
                dataKey="value"
                name="Km operated"
                radius={[5, 5, 0, 0]}
                maxBarSize={56}
                isAnimationActive
                animationDuration={400}
                animationEasing="ease-out"
              >
                {kmByOperator.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.72} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ── Subsidies table ── */}
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.02)',
        border:          '1px solid rgba(255,255,255,0.06)',
        borderRadius:    18,
        overflow:        'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '18px 22px 14px' }}>
          <Landmark size={15} strokeWidth={1.7} style={{ color: '#4ADE80', flexShrink: 0, marginTop: 2 }} />
          <div>
            <h2 style={{
              margin: 0, fontSize: 14, fontWeight: 600,
              color: 'rgba(224,234,255,0.92)', fontFamily: 'Geist, sans-serif', letterSpacing: '-0.01em',
            }}>
              Subsidies by Operator
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(224,234,255,0.35)', fontFamily: 'Geist, sans-serif' }}>
              Standard cost vs. revenue — differential as subsidy
            </p>
          </div>
        </div>
        <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />
        <div style={{ padding: '0 4px 4px' }}>
          <DataTable
            columns={SUBSIDY_COLUMNS}
            data={subsidies}
            loading={loadingSubsidies}
            emptyMessage="No subsidy data available"
          />
        </div>
      </div>

    </div>
  )
}
