import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Users,
  Route,
  CheckCircle,
  Activity,
  DollarSign,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import client from '../api/client'
import KpiCard from '../components/ui/KpiCard'
import PeakDemandChart, { usePeakStats } from '../components/charts/PeakDemandChart'
import StatusBadge from '../components/ui/StatusBadge'

// ── Fetchers ──────────────────────────────────────────────────────────────
const fetchDashboard = async () => {
  const res = await client.get('/api/v1/analytics/dashboard-summary')
  return res.data
}

const fetchPeakDemand = async () => {
  const to   = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const res  = await client.get(`/api/v1/analytics/peak-demand?from=${from}&to=${to}`)
  return res.data ?? []
}

const fetchRecentTrips = async () => {
  const res = await client.get('/api/v1/trips?limit=6&sort=desc')
  return res.data?.trips ?? res.data ?? []
}

// ── Thin horizontal rule ─────────────────────────────────────────────────
const HR = () => (
  <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />
)

// ── Panel wrapper ─────────────────────────────────────────────────────────
function Panel({ children, style }) {
  return (
    <div style={{
      backgroundColor: 'rgba(255,255,255,0.025)',
      border:          '1px solid rgba(255,255,255,0.07)',
      borderRadius:    8,
      overflow:        'hidden',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── Panel header ──────────────────────────────────────────────────────────
function PanelHeader({ title, sub, right }) {
  return (
    <>
      <div style={{
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'space-between',
        gap:            16,
        padding:        '14px 18px',
      }}>
        <div>
          <h2 style={{
            fontSize:      13,
            fontWeight:    600,
            color:         'var(--color-text-primary)',
            margin:        0,
            fontFamily:    'Geist, sans-serif',
            letterSpacing: '-0.01em',
          }}>
            {title}
          </h2>
          {sub && (
            <p style={{
              fontSize:   12,
              color:      'rgba(224,234,255,0.35)',
              margin:     '2px 0 0',
              fontFamily: 'Geist, sans-serif',
            }}>
              {sub}
            </p>
          )}
        </div>
        {right}
      </div>
      <HR />
    </>
  )
}

// ── Trip row ──────────────────────────────────────────────────────────────
function TripRow({ trip, last }) {
  return (
    <div
      style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        padding:         '10px 18px',
        borderBottom:    last ? 'none' : '1px solid rgba(255,255,255,0.04)',
        transition:      'background-color 120ms ease-out',
        cursor:          'default',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.025)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
    >
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 10, minWidth: 0 }}>
        {/* Status dot */}
        <div style={{
          width:           6,
          height:          6,
          borderRadius:    '50%',
          flexShrink:      0,
          backgroundColor:
            trip.status === 'COMPLETED'   ? '#4ADE80' :
            trip.status === 'IN_PROGRESS' ? '#E8A020' :
            trip.status === 'CANCELLED'   ? '#F87171' :
            'rgba(224,234,255,0.25)',
        }} />
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize:     13,
            fontWeight:   500,
            color:        'var(--color-text-primary)',
            fontFamily:   'Geist, sans-serif',
            whiteSpace:   'nowrap',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
          }}>
            {trip.route_code ?? trip.route_id?.slice(0, 8) ?? '—'}
          </div>
          <div style={{
            fontSize:   11,
            color:      'rgba(224,234,255,0.35)',
            fontFamily: 'Geist Mono, monospace',
            marginTop:  2,
          }}>
            {trip.vehicle_code ?? trip.vehicle_id?.slice(0, 8) ?? '—'}
          </div>
        </div>
      </div>
      <StatusBadge status={trip.status} />
    </div>
  )
}

// ── Empty trips ───────────────────────────────────────────────────────────
function TripsEmpty() {
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            8,
      padding:        '40px 18px',
    }}>
      <CheckCircle size={24} style={{ color: 'rgba(224,234,255,0.10)' }} strokeWidth={1.5} />
      <span style={{ fontSize: 12, color: 'rgba(224,234,255,0.30)', fontFamily: 'Geist, sans-serif' }}>
        No trips recorded
      </span>
    </div>
  )
}

// ── Trip skeleton ──────────────────────────────────────────────────────────
function TripsSkeleton() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{
            padding:     '10px 18px',
            borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="skeleton" style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 12, width: '55%', borderRadius: 3, marginBottom: 5 }} />
              <div className="skeleton" style={{ height: 10, width: '35%', borderRadius: 3 }} />
            </div>
            <div className="skeleton" style={{ height: 18, width: 70, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey:        ['dashboard-summary'],
    queryFn:         fetchDashboard,
    refetchInterval: 30_000,
  })

  const { data: peakData = [], isLoading: loadingPeak } = useQuery({
    queryKey: ['peak-demand-week'],
    queryFn:  fetchPeakDemand,
  })

  const { data: trips = [], isLoading: loadingTrips } = useQuery({
    queryKey:        ['recent-trips'],
    queryFn:         fetchRecentTrips,
    refetchInterval: 60_000,
  })

  const peakStats = usePeakStats(peakData)

  const s = summary ?? {}

  const hasWarning = !loadingSummary && (s.active_infractions ?? 0) > 0

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     'flex-end',
        justifyContent: 'space-between',
        flexWrap:       'wrap',
        gap:            8,
        paddingBottom:  6,
      }}>
        <div>
          <h1 style={{
            fontSize:      16,
            fontWeight:    600,
            color:         'var(--color-text-primary)',
            fontFamily:    'Geist, sans-serif',
            margin:        0,
            letterSpacing: '-0.02em',
          }}>
            Overview
          </h1>
          <p style={{
            fontSize:      12,
            color:         'rgba(224,234,255,0.35)',
            margin:        '3px 0 0',
            fontFamily:    'Geist, sans-serif',
            textTransform: 'capitalize',
          }}>
            {today}
          </p>
        </div>

        {/* Operational status */}
        <div style={{
          display:     'flex',
          alignItems:  'center',
          gap:         6,
          fontSize:    11,
          fontWeight:  500,
          color:       '#4ADE80',
          fontFamily:  'Geist, sans-serif',
          letterSpacing: '0.02em',
        }}>
          <span style={{
            width:           5,
            height:          5,
            borderRadius:    '50%',
            backgroundColor: '#4ADE80',
            display:         'inline-block',
            flexShrink:      0,
          }} />
          All systems operational
        </div>
      </div>

      {/* ── Hero row: primary KPI + alert ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Primary KPI — Passengers Today */}
        <div className="lg:col-span-2">
          <KpiCard
            title="Passengers Today"
            value={loadingSummary ? undefined : s.passengers_today}
            icon={Users}
            format="number"
            delta={s.passengers_delta}
            deltaLabel="vs. yesterday"
            size="lg"
          />
        </div>

        {/* Alert card — Active Infractions */}
        <KpiCard
          title="Active Infractions"
          value={loadingSummary ? undefined : s.active_infractions}
          icon={AlertTriangle}
          format="number"
          delta={s.infractions_delta}
          deltaLabel="vs. yesterday"
          size="lg"
          warn={hasWarning}
        />
      </div>

      {/* ── Secondary metrics 4-up ───────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard
          title="Daily Revenue"
          value={loadingSummary ? undefined : s.revenue_today}
          icon={DollarSign}
          format="currency"
          delta={s.revenue_delta}
          deltaLabel="vs. yesterday"
        />
        <KpiCard
          title="Km Operated"
          value={loadingSummary ? undefined : s.km_today}
          unit="km"
          icon={Route}
          format="number"
          delta={s.km_delta}
          deltaLabel="vs. yesterday"
        />
        <KpiCard
          title="Trips Completed"
          value={loadingSummary ? undefined : s.trips_completed}
          icon={CheckCircle}
          format="number"
          delta={s.trips_delta}
          deltaLabel="vs. yesterday"
        />
        <KpiCard
          title="Occupancy Rate"
          value={loadingSummary ? undefined : s.avg_occupancy}
          icon={Activity}
          format="percent"
          delta={s.occupancy_delta}
          deltaLabel="vs. yesterday"
        />
      </div>

      {/* ── Analytics row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">

        {/* Hourly demand chart — 2/3 */}
        <div className="xl:col-span-2">
          <div style={{
            backgroundColor: '#0B0F1A',
            border:          '1px solid rgba(255,255,255,0.07)',
            borderRadius:    12,
            padding:         '20px 22px 22px',
          }}>
            {/* Card header */}
            <div style={{
              display:        'flex',
              alignItems:     'flex-start',
              justifyContent: 'space-between',
              marginBottom:   16,
              gap:            12,
            }}>
              <div>
                <h2 style={{
                  margin:        0,
                  fontSize:      16,
                  fontWeight:    600,
                  color:         'rgba(224,234,255,0.92)',
                  fontFamily:    'Geist, sans-serif',
                  letterSpacing: '-0.02em',
                  lineHeight:    1.2,
                }}>
                  Hourly Demand
                </h2>
                <p style={{
                  margin:     '4px 0 0',
                  fontSize:   12,
                  color:      'rgba(224,234,255,0.38)',
                  fontFamily: 'Geist, sans-serif',
                }}>
                  Last 7 days · total boardings by hour
                </p>
              </div>

              {/* Stat summary */}
              {peakStats && (
                <div style={{
                  display:     'flex',
                  gap:         18,
                  flexShrink:  0,
                  alignItems:  'flex-start',
                }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'rgba(224,234,255,0.32)', fontFamily: 'Geist, sans-serif', marginBottom: 2, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Peak Hour
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#D9A441', fontFamily: 'Geist Mono, monospace' }}>
                      {peakStats.peakLabel}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(224,234,255,0.40)', fontFamily: 'Geist Mono, monospace' }}>
                      {peakStats.peak.total_boardings?.toLocaleString('pt-BR')} pax
                    </div>
                  </div>
                  <div style={{ width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.07)', marginTop: 2 }} />
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'rgba(224,234,255,0.32)', fontFamily: 'Geist, sans-serif', marginBottom: 2, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Avg / Hour
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(224,234,255,0.75)', fontFamily: 'Geist Mono, monospace' }}>
                      {peakStats.avg?.toLocaleString('pt-BR')}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(224,234,255,0.40)', fontFamily: 'Geist Mono, monospace' }}>
                      passengers
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chart */}
            {loadingPeak ? (
              <div className="skeleton" style={{ height: 300, borderRadius: 6 }} />
            ) : (
              <PeakDemandChart data={peakData} height={280} />
            )}
          </div>
        </div>

        {/* Recent trips feed — 1/3 */}
        <Panel>
          <PanelHeader
            title="Recent Trips"
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={12} style={{ color: 'rgba(224,234,255,0.30)' }} strokeWidth={1.8} />
                <span style={{ fontSize: 11, color: 'rgba(224,234,255,0.30)', fontFamily: 'Geist, sans-serif' }}>
                  Live
                </span>
              </div>
            }
          />

          {loadingTrips ? (
            <TripsSkeleton />
          ) : trips.length === 0 ? (
            <TripsEmpty />
          ) : (
            trips.slice(0, 6).map((trip, i) => (
              <TripRow
                key={trip.id ?? i}
                trip={trip}
                last={i === Math.min(trips.length, 6) - 1}
              />
            ))
          )}
        </Panel>

      </div>
    </div>
  )
}
