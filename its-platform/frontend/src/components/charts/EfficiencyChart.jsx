import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

const TICK_STYLE = { fontSize: 11, fill: 'rgba(224,234,255,0.40)', fontFamily: 'Geist, sans-serif' }
const GRID_COLOR = 'rgba(255,255,255,0.06)'

function getEfficiencyColor(value) {
  if (value >= 4) return '#34D399'
  if (value >= 2) return '#FBBF24'
  return '#F87171'
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value ?? 0
  return (
    <div
      className="rounded-lg p-3 text-sm shadow-lg"
      style={{
        backgroundColor: '#0D1827',
        border: '1px solid rgba(255,255,255,0.10)',
        minWidth: 160,
      }}
    >
      <p className="font-semibold mb-2" style={{ color: '#E0EAFF' }}>
        {label}
      </p>
      <div className="flex justify-between gap-4">
        <span style={{ color: 'rgba(224,234,255,0.48)' }}>Pax/km</span>

        <span
          className="font-mono font-semibold"
          style={{ color: getEfficiencyColor(val) }}
        >
          {val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  )
}

export default function EfficiencyChart({ data = [] }) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center h-48 rounded-lg"
        style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
      >
        <span className="text-sm" style={{ color: 'rgba(224,234,255,0.35)' }}>
          No efficiency data available
        </span>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 48)}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 10, right: 40, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />

        <XAxis
          type="number"
          tick={{ ...TICK_STYLE, fontFamily: 'Geist Mono, monospace' }}
          tickLine={false}
          axisLine={{ stroke: GRID_COLOR }}
          domain={[0, 'auto']}
        />

        <YAxis
          type="category"
          dataKey="code"
          width={72}
          tick={TICK_STYLE}
          tickLine={false}
          axisLine={false}
        />

        <Tooltip content={<CustomTooltip />} />

        <ReferenceLine
          x={4}
          stroke="#34D399"
          strokeDasharray="4 2"
          strokeWidth={1.5}
          label={{ value: '4', fill: '#34D399', fontSize: 10, position: 'top' }}
        />
        <ReferenceLine
          x={2}
          stroke="#FBBF24"
          strokeDasharray="4 2"
          strokeWidth={1.5}
          label={{ value: '2', fill: '#FBBF24', fontSize: 10, position: 'top' }}
        />

        <Bar dataKey="pax_per_km" name="Pax/km" radius={[0, 4, 4, 0]} maxBarSize={28}>
          {data.map((entry, idx) => (
            <Cell key={idx} fill={getEfficiencyColor(entry.pax_per_km ?? 0)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
