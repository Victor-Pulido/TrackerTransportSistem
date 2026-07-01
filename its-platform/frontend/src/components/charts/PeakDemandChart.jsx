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

// ── Period config ─────────────────────────────────────────────────────────
const PERIODS = {
  morning: { color: '#D9A441', label: 'Morning Peak', bandFill: 'rgba(217,164,65,0.045)' },
  midday:  { color: '#4B5563', label: 'Midday',       bandFill: null },
  evening: { color: '#D06A6A', label: 'Evening Peak', bandFill: 'rgba(208,106,106,0.045)' },
}
const AVG_COLOR = '#FBBF24'

function getPeriod(hour) {
  const h = parseInt(hour, 10)
  if (h >= 6  && h <= 9)  return 'morning'
  if (h >= 17 && h <= 20) return 'evening'
  return 'midday'
}

function fmtHour(h24) {
  const h = parseInt(h24, 10)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:00 ${ampm}`
}

// ── Tooltip ───────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const p = PERIODS[getPeriod(label)]
  const boardings = payload.find((x) => x.dataKey === 'total_boardings')
  const avg       = payload.find((x) => x.dataKey === 'moving_avg')
  const bVal      = boardings?.value ?? 0
  const aVal      = avg?.value
  const pct       = aVal && aVal > 0 ? ((bVal - aVal) / aVal) * 100 : null

  return (
    <div style={{
      backgroundColor: '#111827',
      border:          '1px solid rgba(255,255,255,0.10)',
      borderRadius:    12,
      padding:         '12px 14px',
      minWidth:        172,
      boxShadow:       '0 12px 36px rgba(0,0,0,0.65)',
    }}>
      {/* Hour */}
      <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(224,234,255,0.92)', fontFamily: 'Geist, sans-serif', letterSpacing: '-0.01em', marginBottom: 1 }}>
        {fmtHour(label)}
      </div>
      {/* Period label */}
      <div style={{ fontSize: 11, fontWeight: 500, color: p.color, fontFamily: 'Geist, sans-serif', marginBottom: 10 }}>
        {p.label}
      </div>

      <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 9 }} />

      {/* Passengers row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: pct != null ? 6 : 0 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: p.color, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 12, color: 'rgba(224,234,255,0.45)', fontFamily: 'Geist, sans-serif' }}>
          Passengers
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(224,234,255,0.92)', fontFamily: 'Geist Mono, monospace' }}>
          {bVal.toLocaleString('pt-BR')}
        </span>
      </div>

      {/* % vs avg row */}
      {pct != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 14, height: 2, backgroundColor: AVG_COLOR, borderRadius: 1, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 11, color: 'rgba(224,234,255,0.38)', fontFamily: 'Geist, sans-serif' }}>
            vs weekly avg
          </span>
          <span style={{
            fontSize:   12,
            fontWeight: 500,
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

// ── Legend ────────────────────────────────────────────────────────────────
function ChartLegend() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      {Object.entries(PERIODS).map(([key, { color, label }]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'rgba(224,234,255,0.42)', fontFamily: 'Geist, sans-serif' }}>
            {label}
          </span>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 18, height: 2, backgroundColor: AVG_COLOR, borderRadius: 1, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'rgba(224,234,255,0.42)', fontFamily: 'Geist, sans-serif' }}>
          7-day Average
        </span>
      </div>
    </div>
  )
}

// ── Exported stat helper (used by parent cards) ───────────────────────────
export function usePeakStats(data) {
  return useMemo(() => {
    if (!data.length) return null
    const peak = data.reduce((best, d) =>
      (d.total_boardings ?? 0) > (best?.total_boardings ?? 0) ? d : best, data[0])
    const avg = Math.round(
      data.reduce((s, d) => s + (d.total_boardings ?? 0), 0) / data.length
    )
    return { peak, avg, peakLabel: fmtHour(peak.hour_of_day) }
  }, [data])
}

// ── Main chart ────────────────────────────────────────────────────────────
export default function PeakDemandChart({ data = [], height = 260 }) {
  const { maxAvg, minAvg, xTicks } = useMemo(() => {
    const avgs  = data.map((d) => d.moving_avg).filter((v) => v != null && !isNaN(v))
    const hours = data.map((d) => parseInt(d.hour_of_day, 10))
    const minH  = hours.length ? Math.min(...hours) : 0
    const maxH  = hours.length ? Math.max(...hours) : 23
    const ticks = []
    const hourSet = new Set(hours)
    for (let h = minH; h <= maxH; h++) {
      if (h % 2 === 0 && hourSet.has(h)) ticks.push(h)
    }
    return {
      maxAvg: avgs.length ? Math.max(...avgs) : null,
      minAvg: avgs.length ? Math.min(...avgs) : null,
      xTicks: ticks,
    }
  }, [data])

  // Dot only at max/min of moving average
  const renderDot = ({ cx, cy, value, index }) => {
    if (!value || (value !== maxAvg && value !== minAvg)) return null
    return (
      <circle
        key={`dot-${index}`}
        cx={cx}
        cy={cy}
        r={4}
        fill={AVG_COLOR}
        stroke="#0F1117"
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
          marginTop:       16,
          borderRadius:    8,
          backgroundColor: 'rgba(255,255,255,0.01)',
          border:          '1px dashed rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: 13, color: 'rgba(224,234,255,0.28)', fontFamily: 'Geist, sans-serif' }}>
            No demand data for the selected period
          </span>
        </div>
      </>
    )
  }

  return (
    <>
      <ChartLegend />
      <div style={{ marginTop: 16 }}>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart
            data={data}
            barCategoryGap="12%"
            margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
          >
            {/* ── Background period bands ── */}
            <ReferenceArea x1={6}  x2={9}  fill="rgba(217,164,65,0.045)"  ifOverflow="hidden" />
            <ReferenceArea x1={17} x2={20} fill="rgba(208,106,106,0.045)" ifOverflow="hidden" />

            {/* ── Grid ── */}
            <CartesianGrid
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="0"
              vertical={false}
            />

            {/* ── Axes ── */}
            <XAxis
              dataKey="hour_of_day"
              ticks={xTicks}
              tickFormatter={(v) => `${String(parseInt(v, 10)).padStart(2, '0')}:00`}
              tick={{ fontSize: 11, fill: 'rgba(224,234,255,0.28)', fontFamily: 'Geist Mono, monospace' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'rgba(224,234,255,0.22)', fontFamily: 'Geist Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              width={32}
            />

            {/* ── Tooltip + vertical cursor ── */}
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1, strokeDasharray: '3 2' }}
            />

            {/* ── Bars ── */}
            <Bar
              dataKey="total_boardings"
              radius={[5, 5, 0, 0]}
              maxBarSize={22}
              isAnimationActive
              animationDuration={650}
              animationBegin={0}
              animationEasing="ease-out"
            >
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={PERIODS[getPeriod(entry.hour_of_day)].color}
                  fillOpacity={0.80}
                />
              ))}
            </Bar>

            {/* ── Average line ── */}
            <Line
              type="monotone"
              dataKey="moving_avg"
              stroke={AVG_COLOR}
              strokeWidth={2.5}
              dot={renderDot}
              activeDot={{ r: 5, fill: AVG_COLOR, stroke: '#0F1117', strokeWidth: 2 }}
              isAnimationActive
              animationDuration={900}
              animationBegin={700}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
