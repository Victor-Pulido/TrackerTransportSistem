import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart2, TrendingUp, Activity, Route } from 'lucide-react'
import client from '../api/client'
import LoadProfileChart from '../components/charts/LoadProfileChart'
import PeakDemandChart   from '../components/charts/PeakDemandChart'
import EfficiencyChart   from '../components/charts/EfficiencyChart'
import DataTable         from '../components/ui/DataTable'

// ── Fetchers ──────────────────────────────────────────────────────────────
const fetchTrips = async () => {
  const res = await client.get('/api/v1/trips?limit=50&sort=desc')
  return res.data?.trips ?? res.data ?? []
}

const fetchLoadProfile = async (tripId) => {
  if (!tripId) return []
  const res = await client.get(`/api/v1/analytics/load-profile?trip_id=${tripId}`)
  return res.data ?? []
}

const fetchPeakDemand = async (from, to) => {
  const res = await client.get(`/api/v1/analytics/peak-demand?from=${from}&to=${to}`)
  return res.data ?? []
}

const fetchEfficiency = async () => {
  const res = await client.get('/api/v1/analytics/efficiency')
  return res.data ?? []
}

const fetchOccupancy = async () => {
  const res = await client.get('/api/v1/analytics/occupancy-rate')
  return res.data ?? []
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

// ── Tab button ────────────────────────────────────────────────────────────
function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 active:scale-[0.98] whitespace-nowrap"
      style={{
        backgroundColor: active ? 'rgba(232,160,32,0.14)' : 'transparent',
        color:           active ? '#E8A020' : 'rgba(224,234,255,0.42)',
        border:          active ? '1px solid rgba(232,160,32,0.28)' : '1px solid transparent',
      }}
      onMouseEnter={(e) => !active && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')}
      onMouseLeave={(e) => !active && (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <Icon size={15} strokeWidth={1.8} />
      {label}
    </button>
  )
}

// ── Occupancy progress bar ────────────────────────────────────────────────
function OccupancyBar({ pct }) {
  const clamped = Math.min(Math.max(pct ?? 0, 0), 100)
  const color =
    clamped >= 90 ? '#F87171' :
    clamped >= 70 ? '#FBBF24' :
    '#34D399'

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: 5, backgroundColor: 'rgba(255,255,255,0.07)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="text-xs font-mono font-semibold w-10 text-right tabular-nums"
        style={{ color }}
      >
        {clamped.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
      </span>
    </div>
  )
}

// ── Column definitions ────────────────────────────────────────────────────
const EFFICIENCY_COLUMNS = [
  { key: 'code',             header: 'Route' },
  { key: 'name',             header: 'Name' },
  { key: 'trips_completed',  header: 'Trips',      align: 'right',
    render: (v) => <span className="font-mono">{Number(v ?? 0).toLocaleString('pt-BR')}</span> },
  { key: 'total_passengers', header: 'Passengers', align: 'right',
    render: (v) => <span className="font-mono">{Number(v ?? 0).toLocaleString('pt-BR')}</span> },
  { key: 'total_km',         header: 'Km',         align: 'right',
    render: (v) => <span className="font-mono">{Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span> },
  { key: 'pax_per_km',       header: 'Pax/km',     align: 'right',
    render: (v) => {
      const val = Number(v ?? 0)
      const color = val >= 4 ? '#34D399' : val >= 2 ? '#FBBF24' : '#F87171'
      return <span className="font-mono font-semibold" style={{ color }}>{val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    }
  },
]

const OCCUPANCY_COLUMNS = [
  { key: 'trip_id',            header: 'Trip ID',
    render: (v) => <span className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>{String(v).slice(0, 10)}...</span> },
  { key: 'internal_code',      header: 'Vehicle' },
  { key: 'capacity',           header: 'Capacity', align: 'right',
    render: (v) => <span className="font-mono">{v}</span> },
  { key: 'peak_pax_on_board',  header: 'Peak Pax', align: 'right',
    render: (v) => <span className="font-mono font-semibold">{Number(v ?? 0).toLocaleString('pt-BR')}</span> },
  { key: 'peak_occupancy_pct', header: 'Occupancy',
    render: (v) => <OccupancyBar pct={Number(v ?? 0)} /> },
]

// ── Main component ────────────────────────────────────────────────────────
const TABS = [
  { id: 'load',       label: 'Load Profile',     icon: BarChart2  },
  { id: 'peak',       label: 'Peak Hours',        icon: TrendingUp },
  { id: 'efficiency', label: 'Line Efficiency',   icon: Route      },
  { id: 'occupancy',  label: 'Occupancy Rate',    icon: Activity   },
]

export default function Analytics() {
  const [tab,    setTab]    = useState('load')
  const [tripId, setTripId] = useState('')
  const [period, setPeriod] = useState('7d')

  const dateRange = getDateRange(period)

  const { data: trips = [], isLoading: loadingTrips } = useQuery({
    queryKey: ['trips-list'],
    queryFn:  fetchTrips,
  })

  const { data: loadProfile = [], isLoading: loadingLoad } = useQuery({
    queryKey: ['load-profile', tripId],
    queryFn:  () => fetchLoadProfile(tripId),
    enabled:  Boolean(tripId),
  })

  const { data: peakData = [], isLoading: loadingPeak } = useQuery({
    queryKey: ['peak-demand', dateRange.from, dateRange.to],
    queryFn:  () => fetchPeakDemand(dateRange.from, dateRange.to),
  })

  const { data: effData = [], isLoading: loadingEff } = useQuery({
    queryKey: ['efficiency'],
    queryFn:  fetchEfficiency,
  })

  const { data: occData = [], isLoading: loadingOcc } = useQuery({
    queryKey: ['occupancy'],
    queryFn:  fetchOccupancy,
  })

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div>
        <h1
          className="text-xl font-semibold tracking-tight"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'Geist, sans-serif' }}
        >
          Transport Analytics
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Operational and demand metrics
        </p>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1 p-1 rounded-xl overflow-x-auto"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)' }}
      >
        {TABS.map((t) => (
          <TabButton
            key={t.id}
            active={tab === t.id}
            onClick={() => setTab(t.id)}
            icon={t.icon}
            label={t.label}
          />
        ))}
      </div>

      {/* ── Tab: Load Profile ─────────────────────────────────────────── */}
      {tab === 'load' && (
        <div
          className="rounded-xl p-6"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Stop-by-Stop Load Profile
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                Passengers on board at each segment of the selected trip
              </p>
            </div>

            {/* Trip selector */}
            <select
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
              className="select-field"
              style={{ minWidth: 220, fontFamily: 'Geist, sans-serif' }}
            >
              <option value="">Select a trip...</option>
              {loadingTrips && <option disabled>Loading trips...</option>}
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.route_code ?? t.route_id?.slice(0, 8)} —{' '}
                  {t.vehicle_code ?? t.vehicle_id?.slice(0, 8)} —{' '}
                  {t.scheduled_start
                    ? new Date(t.scheduled_start).toLocaleDateString('pt-BR')
                    : '—'}
                </option>
              ))}
            </select>
          </div>

          {loadingLoad ? (
            <div className="skeleton h-72 rounded-lg" />
          ) : (
            <LoadProfileChart data={loadProfile} />
          )}
        </div>
      )}

      {/* ── Tab: Peak Hours ─────────────────────────────────────────── */}
      {tab === 'peak' && (
        <div
          className="rounded-xl p-6"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Peak Demand Hours
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                Boarding distribution by hour of day — AM and PM peaks
              </p>
            </div>

            {/* Period selector */}
            <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ border: '1px solid var(--color-border)', backgroundColor: 'rgba(255,255,255,0.03)' }}>
              {['7d', '30d'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
                  style={{
                    backgroundColor: period === p ? 'rgba(232,160,32,0.14)' : 'transparent',
                    color:           period === p ? '#E8A020' : 'rgba(224,234,255,0.42)',
                    border:          period === p ? '1px solid rgba(232,160,32,0.28)' : '1px solid transparent',
                  }}
                >
                  {p === '7d' ? '7 days' : '30 days'}
                </button>
              ))}
            </div>
          </div>

          {loadingPeak ? (
            <div className="skeleton h-80 rounded-lg" />
          ) : (
            <PeakDemandChart data={peakData} />
          )}
        </div>
      )}

      {/* ── Tab: Line Efficiency ──────────────────────────────────────── */}
      {tab === 'efficiency' && (
        <div className="flex flex-col gap-6">
          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)' }}
          >
            <div className="mb-4">
              <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Operational Efficiency — Pax/km by Line
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                Green &gt;4 pax/km · Yellow 2–4 · Red &lt;2
              </p>
            </div>
            {loadingEff ? (
              <div className="skeleton h-48 rounded-lg" />
            ) : (
              <EfficiencyChart data={effData} />
            )}
          </div>

          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)' }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Route Detail
            </h2>
            <DataTable
              columns={EFFICIENCY_COLUMNS}
              data={effData}
              loading={loadingEff}
              emptyMessage="No efficiency data available"
            />
          </div>
        </div>
      )}

      {/* ── Tab: Occupancy Rate ───────────────────────────────────────── */}
      {tab === 'occupancy' && (
        <div
          className="rounded-xl p-6"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)' }}
        >
          <div className="mb-4">
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Peak Occupancy Rate by Trip
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              Peak passengers on board as percentage of vehicle capacity
            </p>
          </div>
          <DataTable
            columns={OCCUPANCY_COLUMNS}
            data={occData}
            loading={loadingOcc}
            emptyMessage="No occupancy data available"
          />
        </div>
      )}
    </div>
  )
}
