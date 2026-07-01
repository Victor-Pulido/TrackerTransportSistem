import { useMemo } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts'

// ── Design system palette — cool, desaturated, inspired by Linear/Vercel ──────
// Bars use period-coded teal/indigo/violet; line uses cyan as a brighter accent
const PERIODS = {
  morning: { color: '#5EEAD4', label: 'Morning Peak', bandFill: 'rgba(94,234,212,0.05)' },
  midday:  { color: '#818CF8', label: 'Midday',       bandFill: null },
  evening: { color: '#A78BFA', label: 'Evening Peak', bandFill: 'rgba(167,139,250,0.05)' },
}
const AVG_COLOR   = '#22D3EE'   // cyan — noticeably brighter than the bars
const GLOW_COLOR  = 'rgba(34,211,238,0.30)'

function getPeriod(slot) {
  const h = parseInt(slot?.split(':')[0] ?? '12', 10)
  if (h >= 6  && h <= 9)  return 'morning'
  if (h >= 17 && h <= 20) return 'evening'
  return 'midday'
}

function fmtSlot(slot) {
  if (!slot) return '—'
  const [hStr, mStr = '00'] = slot.split(':')
  const h    = parseInt(hStr, 10)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${mStr} ${ampm}`
}

// ── Floating card tooltip ─────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const period    = PERIODS[getPeriod(label)]
  const boardings = payload.find((x) => x.dataKey === 'total_boardings')
  const avg       = payload.find((x) => x.dataKey === 'moving_avg')
  const bVal      = boardings?.value ?? 0
  const aVal      = avg?.value
  const pct       = aVal && aVal > 0 ? ((bVal - aVal) / aVal) * 100 : null

  return (
    <div style={{
      backgroundColor: '#111827',
      border:          '1px solid rgba(255,255,255,0.08)',
      borderRadius:    16,
      padding:         '14px 16px',
      minWidth:        192,
      boxShadow:       '0 8px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)',
    }}>
      {/* Time + period */}
      <div style={{
        fontSize:   14,
        fontWeight: 600,
        color:      'rgba(224,234,255,0.95)',
        fontFamily: 'Geist, sans-serif',
        letterSpacing: '-0.01em',
      }}>
        {fmtSlot(label)}
      </div>
      <div style={{
        fontSize:    11,
        fontWeight:  500,
        color:       period.color,
        fontFamily:  'Geist, sans-serif',
        marginTop:   2,
        marginBottom: 12,
        opacity:     0.90,
      }}>
        {period.label}
      </div>

      <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 10 }} />

      {/* Boardings */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: aVal != null ? 7 : 0 }}>
        <div style={{
          width:           6,
          height:          6,
          borderRadius:    '50%',
          backgroundColor: period.color,
          flexShrink:      0,
          opacity:         0.85,
        }} />
        <span style={{ flex: 1, fontSize: 11, color: 'rgba(224,234,255,0.38)', fontFamily: 'Geist, sans-serif' }}>
          Boardings
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(224,234,255,0.92)', fontFamily: 'Geist Mono, monospace' }}>
          {bVal.toLocaleString('pt-BR')}
        </span>
      </div>

      {/* 7-day avg */}
      {aVal != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: pct != null ? 7 : 0 }}>
          <div style={{ width: 14, height: 2, backgroundColor: AVG_COLOR, borderRadius: 1, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 11, color: 'rgba(224,234,255,0.35)', fontFamily: 'Geist, sans-serif' }}>
            7-day avg
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(224,234,255,0.55)', fontFamily: 'Geist Mono, monospace' }}>
            {Math.round(aVal).toLocaleString('pt-BR')}
          </span>
        </div>
      )}

      {/* vs avg delta */}
      {pct != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 11, color: 'rgba(224,234,255,0.32)', fontFamily: 'Geist, sans-serif' }}>
            vs avg
          </span>
          <span style={{
            fontSize:   12,
            fontWeight: 600,
            fontFamily: 'Geist Mono, monospace',
            color:      pct > 0 ? '#4ADE80' : '#F87171',
          }}>
            {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  )
}

// ── Minimal inline legend ─────────────────────────────────────────────────────
function ChartLegend() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      {Object.entries(PERIODS).map(([key, { color, label }]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width:           6,
            height:          6,
            borderRadius:    '50%',
            backgroundColor: color,
            flexShrink:      0,
            opacity:         0.80,
          }} />
          <span style={{ fontSize: 11, color: 'rgba(224,234,255,0.32)', fontFamily: 'Geist, sans-serif' }}>
            {label}
          </span>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 16, height: 2, backgroundColor: AVG_COLOR, borderRadius: 1, flexShrink: 0, opacity: 0.85 }} />
        <span style={{ fontSize: 11, color: 'rgba(224,234,255,0.32)', fontFamily: 'Geist, sans-serif' }}>
          7-day avg
        </span>
      </div>
    </div>
  )
}

// ── Exported stat helper (used by parent) ─────────────────────────────────────
export function usePeakStats(data) {
  return useMemo(() => {
    if (!data.length) return null
    const peak = data.reduce((best, d) =>
      (d.total_boardings ?? 0) > (best?.total_boardings ?? 0) ? d : best, data[0])
    const avg = Math.round(
      data.reduce((s, d) => s + (d.total_boardings ?? 0), 0) / data.length
    )
    return { peak, avg, peakLabel: fmtSlot(peak.hour_of_day) }
  }, [data])
}

// ── Main chart ────────────────────────────────────────────────────────────────
export default function PeakDemandChart({ data = [], height = 260 }) {
  const { maxAvg, minAvg, xTicks } = useMemo(() => {
    const avgs    = data.map((d) => d.moving_avg).filter((v) => v != null && !isNaN(v))
    const allSlots = data.map((d) => d.hour_of_day)
    const ticks    = allSlots.filter((s) => s?.endsWith(':00'))
    return {
      maxAvg: avgs.length ? Math.max(...avgs) : null,
      minAvg: avgs.length ? Math.min(...avgs) : null,
      xTicks: ticks,
    }
  }, [data])

  // Only show dots at peak and trough of the moving avg line
  const renderDot = ({ cx, cy, value, index }) => {
    if (!value || (value !== maxAvg && value !== minAvg)) return null
    return (
      <circle
        key={`dot-${index}`}
        cx={cx}
        cy={cy}
        r={4}
        fill={AVG_COLOR}
        stroke="#0D1421"
        strokeWidth={2}
      />
    )
  }

  if (!data.length) {
    return (
      <>
        <ChartLegend />
        <div style={{
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          height:          height,
          marginTop:       20,
          borderRadius:    12,
          backgroundColor: 'rgba(255,255,255,0.01)',
          border:          '1px dashed rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: 13, color: 'rgba(224,234,255,0.22)', fontFamily: 'Geist, sans-serif' }}>
            No demand data for the selected period
          </span>
        </div>
      </>
    )
  }

  return (
    <>
      <ChartLegend />
      <div style={{ marginTop: 20 }}>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart
            data={data}
            barCategoryGap="3%"
            margin={{ top: 6, right: 4, left: -10, bottom: 0 }}
          >
            {/* Peak-period context bands — translucent, color-coded */}
            <ReferenceArea x1="06:00" x2="09:45" fill="rgba(94,234,212,0.05)"   ifOverflow="hidden" />
            <ReferenceArea x1="17:00" x2="20:45" fill="rgba(167,139,250,0.05)"  ifOverflow="hidden" />

            {/* Almost-invisible dashed horizontal grid */}
            <CartesianGrid
              stroke="rgba(255,255,255,0.035)"
              strokeDasharray="4 4"
              vertical={false}
            />

            <XAxis
              dataKey="hour_of_day"
              ticks={xTicks}
              tickFormatter={(v) => {
                const h    = parseInt(v.split(':')[0], 10)
                const ampm = h < 12 ? 'AM' : 'PM'
                const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h
                return `${h12}${ampm}`
              }}
              tick={{ fontSize: 10, fill: 'rgba(224,234,255,0.20)', fontFamily: 'Geist Mono, monospace' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'rgba(224,234,255,0.16)', fontFamily: 'Geist Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              width={30}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1, strokeDasharray: '3 2' }}
            />

            {/* Bars — rounded top, medium opacity, period-coloured */}
            <Bar
              dataKey="total_boardings"
              radius={[4, 4, 0, 0]}
              maxBarSize={8}
              isAnimationActive
              animationDuration={400}
              animationBegin={0}
              animationEasing="ease-out"
            >
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={PERIODS[getPeriod(entry.hour_of_day)].color}
                  fillOpacity={0.70}
                />
              ))}
            </Bar>

            {/* Moving-avg line — cyan, glowing, dominant */}
            <Line
              type="monotone"
              dataKey="moving_avg"
              stroke={AVG_COLOR}
              strokeWidth={3}
              dot={renderDot}
              activeDot={{ r: 5, fill: AVG_COLOR, stroke: '#0D1421', strokeWidth: 2 }}
              style={{ filter: `drop-shadow(0 0 6px ${GLOW_COLOR})` }}
              isAnimationActive
              animationDuration={550}
              animationBegin={150}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
