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
} from 'recharts'

const TICK = { fontSize: 11, fill: 'rgba(224,234,255,0.28)', fontFamily: 'Geist Mono, monospace' }
const GRID = 'rgba(255,255,255,0.04)'

function barFill(hour) {
  const h = parseInt(hour, 10)
  if (h >= 6  && h <= 9)  return 'rgba(232,160,32,0.55)'   // AM peak → amber brand
  if (h >= 17 && h <= 20) return 'rgba(248,113,113,0.55)'  // PM peak → red
  return 'rgba(100,116,139,0.30)'                           // off-peak → slate
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const h    = parseInt(label, 10)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h
  const boardings = payload.find((p) => p.dataKey === 'total_boardings')
  const avg       = payload.find((p) => p.dataKey === 'moving_avg')

  return (
    <div style={{
      backgroundColor: '#090E18',
      border:          '1px solid rgba(255,255,255,0.09)',
      borderRadius:    6,
      padding:         '10px 14px',
      minWidth:        148,
      boxShadow:       '0 8px 24px rgba(0,0,0,0.50)',
    }}>
      <p style={{
        fontSize:      12,
        fontWeight:    600,
        color:         'rgba(224,234,255,0.80)',
        fontFamily:    'Geist, sans-serif',
        margin:        '0 0 8px',
        letterSpacing: '-0.01em',
      }}>
        {h12}:00 {ampm}
      </p>
      <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 8 }} />
      {boardings && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: avg?.value != null ? 4 : 0 }}>
          <span style={{ fontSize: 11, color: 'rgba(224,234,255,0.40)', fontFamily: 'Geist, sans-serif' }}>
            Boardings
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'Geist Mono, monospace', color: 'rgba(224,234,255,0.80)' }}>
            {typeof boardings.value === 'number'
              ? boardings.value.toLocaleString('pt-BR')
              : boardings.value}
          </span>
        </div>
      )}
      {avg?.value != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
          <span style={{ fontSize: 11, color: 'rgba(224,234,255,0.40)', fontFamily: 'Geist, sans-serif' }}>
            7-day avg
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'Geist Mono, monospace', color: '#E8A020' }}>
            {Number(avg.value).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}
    </div>
  )
}

// Compact legend rendered manually — avoids Recharts Legend margin issues
function ChartLegend() {
  const items = [
    { color: 'rgba(232,160,32,0.55)',  label: 'AM peak' },
    { color: 'rgba(248,113,113,0.55)', label: 'PM peak' },
    { color: 'rgba(100,116,139,0.30)', label: 'Off-peak' },
    { color: '#E8A020',                label: '7-day avg', line: true },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      {items.map(({ color, label, line }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {line
            ? <div style={{ width: 20, height: 1.5, backgroundColor: color, borderRadius: 1 }} />
            : <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
          }
          <span style={{ fontSize: 11, color: 'rgba(224,234,255,0.38)', fontFamily: 'Geist, sans-serif' }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function PeakDemandChart({ data = [] }) {
  if (!data.length) {
    return (
      <div style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        height:          220,
        borderRadius:    6,
        backgroundColor: 'rgba(255,255,255,0.01)',
        border:          '1px dashed rgba(255,255,255,0.06)',
      }}>
        <span style={{ fontSize: 13, color: 'rgba(224,234,255,0.28)', fontFamily: 'Geist, sans-serif' }}>
          No demand data for the selected period
        </span>
      </div>
    )
  }

  return (
    <div>
      <ChartLegend />
      <div style={{ marginTop: 16 }}>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 2, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />

            <XAxis
              dataKey="hour_of_day"
              tickFormatter={(v) => `${v}h`}
              tick={TICK}
              tickLine={false}
              axisLine={false}
              interval={1}
            />

            <YAxis
              tick={TICK}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              width={34}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.025)' }} />

            <Bar dataKey="total_boardings" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
              {data.map((entry, i) => (
                <Cell key={i} fill={barFill(entry.hour_of_day)} />
              ))}
            </Bar>

            <Line
              type="monotone"
              dataKey="moving_avg"
              stroke="#E8A020"
              strokeWidth={1.5}
              dot={false}
              strokeOpacity={0.85}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
