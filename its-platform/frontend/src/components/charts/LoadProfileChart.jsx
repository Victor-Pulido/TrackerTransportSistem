import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

const MAX_CAPACITY = 80
const TICK_STYLE   = { fontSize: 11, fill: 'rgba(224,234,255,0.40)', fontFamily: 'Geist, sans-serif' }
const GRID_COLOR   = 'rgba(255,255,255,0.06)'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload ?? {}
  return (
    <div
      className="rounded-lg p-3 text-sm shadow-lg"
      style={{
        backgroundColor: '#0D1827',
        border: '1px solid rgba(255,255,255,0.10)',
        minWidth: 190,
      }}
    >
      <p className="font-semibold mb-2" style={{ color: '#E0EAFF' }}>
        {label}
      </p>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between gap-4">
          <span style={{ color: 'rgba(224,234,255,0.48)' }}>Pasajeros a bordo</span>
          <span className="font-mono font-semibold" style={{ color: '#60A5FA' }}>
            {d.pax_on_board ?? 0}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span style={{ color: 'rgba(224,234,255,0.48)' }}>Subidas</span>
          <span className="font-mono font-semibold" style={{ color: '#34D399' }}>
            +{d.boardings ?? 0}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span style={{ color: 'rgba(224,234,255,0.48)' }}>Bajadas</span>
          <span className="font-mono font-semibold" style={{ color: '#F87171' }}>
            -{d.alightings ?? 0}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function LoadProfileChart({ data = [] }) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center h-48 rounded-lg"
        style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
      >
        <span className="text-sm" style={{ color: 'rgba(224,234,255,0.35)' }}>
          Seleccione un viaje para ver el perfil de carga
        </span>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="loadGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#60A5FA" stopOpacity={0.22} />
            <stop offset="95%" stopColor="#60A5FA" stopOpacity={0}    />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />

        <XAxis
          dataKey="stop_name"
          tick={TICK_STYLE}
          tickLine={false}
          axisLine={{ stroke: GRID_COLOR }}
          interval="preserveStartEnd"
        />

        <YAxis
          tick={{ ...TICK_STYLE, fontFamily: 'Geist Mono, monospace' }}
          tickLine={false}
          axisLine={false}
          domain={[0, MAX_CAPACITY + 10]}
        />

        <Tooltip content={<CustomTooltip />} />

        <ReferenceLine
          y={MAX_CAPACITY}
          stroke="#F87171"
          strokeDasharray="6 3"
          strokeWidth={1.5}
          label={{
            value: `Cap. máx. ${MAX_CAPACITY}`,
            position: 'insideTopRight',
            fill: '#F87171',
            fontSize: 11,
            fontFamily: 'Geist, sans-serif',
          }}
        />

        <Area
          type="monotone"
          dataKey="pax_on_board"
          name="Pasajeros a bordo"
          stroke="#60A5FA"
          strokeWidth={2}
          fill="url(#loadGradient)"
          dot={{ r: 3, fill: '#60A5FA', strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#E8A020', strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
