import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import { Wifi, WifiOff, Bus, Clock } from 'lucide-react'
import L from 'leaflet'
import client from '../api/client'
import useWebSocket from '../hooks/useWebSocket'

// Fix Leaflet default icon paths (required when bundled with Vite)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// São Paulo — Praça da Sé
const SP_CENTER = [-23.5506, -46.6333]

const fetchStops = async () => {
  const res = await client.get('/api/v1/stops')
  return res.data?.stops ?? res.data ?? []
}

const fetchRoutes = async () => {
  const res = await client.get('/api/v1/routes')
  return res.data?.routes ?? res.data ?? []
}

// Route polylines — coordinates match seeder stops (SPTrans nomenclature)
const ROUTE_POLYLINES = {
  // 407E-10: Expresso Sapopemba → Praça da Sé (east express, 25 km)
  '407E-10': [
    [-23.6086, -46.4834],  // Terminal Sapopemba
    [-23.5363, -46.5763],  // Tatuapé
    [-23.5457, -46.6060],  // Bresser
    [-23.5457, -46.6172],  // Brás
    [-23.5506, -46.6333],  // Praça da Sé
  ],
  // 407A-10: Local Sapopemba → Praça da Sé (east local, 27 km)
  '407A-10': [
    [-23.6086, -46.4834],  // Terminal Sapopemba
    [-23.5598, -46.5284],  // Aricanduva
    [-23.5327, -46.5499],  // Vila Matilde
    [-23.5175, -46.5501],  // Penha
    [-23.5457, -46.6172],  // Brás
    [-23.5428, -46.6327],  // Mercado Municipal
    [-23.5506, -46.6333],  // Praça da Sé
  ],
  // 3021-10: Jardim Peri → Praça da Sé (north corridor, 20 km)
  '3021-10': [
    [-23.4420, -46.6380],  // Terminal Jardim Peri
    [-23.5014, -46.6286],  // Santana
    [-23.5163, -46.6327],  // Carandiru
    [-23.5292, -46.6371],  // Tietê
    [-23.5344, -46.6364],  // Luz
    [-23.5506, -46.6333],  // Praça da Sé
  ],
  // 5110-10: Santo André → Largo São Bento (ABC main axis, 30 km)
  '5110-10': [
    [-23.6680, -46.5346],  // Terminal Santo André
    [-23.6398, -46.5552],  // Rudge Ramos (SBC)
    [-23.6198, -46.5633],  // São Caetano do Sul
    [-23.5888, -46.6059],  // Ipiranga
    [-23.5583, -46.6340],  // Liberdade
    [-23.5393, -46.6331],  // Largo São Bento
  ],
  // 5110-21: Santo André → Largo São Bento via Av. do Estado (variant, 28 km)
  '5110-21': [
    [-23.6680, -46.5346],  // Terminal Santo André
    [-23.6385, -46.5481],  // Fundação ABC
    [-23.5504, -46.5885],  // Mooca
    [-23.5457, -46.6060],  // Bresser
    [-23.5457, -46.6172],  // Brás
    [-23.5393, -46.6331],  // Largo São Bento
  ],
  // 4310-10: Terminal Santo Amaro → Praça da República via Av. Paulista (24 km)
  '4310-10': [
    [-23.6546, -46.7045],  // Terminal Santo Amaro
    [-23.6119, -46.6748],  // Campo Belo
    [-23.5873, -46.6587],  // Ibirapuera
    [-23.5619, -46.6560],  // MASP / Av. Paulista
    [-23.5536, -46.6569],  // Consolação
    [-23.5437, -46.6407],  // Praça da República
  ],
}

// Colors: SPMove Norte routes → amber/orange tones; SPMove Sul → blue/teal/purple
const ROUTE_COLORS = {
  '407E-10': '#E8A020', // amber  — main east express
  '407A-10': '#F97316', // orange — east local
  '3021-10': '#34D399', // green  — north corridor
  '5110-10': '#60A5FA', // blue   — ABC main axis (busiest)
  '5110-21': '#38BDF8', // sky    — ABC variant
  '4310-10': '#A78BFA', // purple — south/Paulista
}

function BusMarker({ position, vehicleCode, speed, timestamp }) {
  return (
    <CircleMarker
      center={position}
      radius={10}
      pathOptions={{
        color:       '#E8A020',
        fillColor:   '#E8A020',
        fillOpacity: 0.9,
        weight:      3,
      }}
    >
      <Popup>
        <div style={{ fontFamily: 'Geist, sans-serif', minWidth: 160, fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#E8A020', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bus size={12} color="#06090F" />
            </div>
            <span style={{ fontWeight: 600, color: '#1A2533' }}>{vehicleCode}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#5A6A7E' }}>Speed</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1A2533' }}>
                {speed != null ? `${speed} km/h` : '—'}
              </span>
            </div>
            {timestamp && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#5A6A7E' }}>Updated</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#5A6A7E' }}>
                  {new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            )}
          </div>
        </div>
      </Popup>
    </CircleMarker>
  )
}

function StopMarker({ stop }) {
  return (
    <CircleMarker
      center={[stop.lat, stop.lng]}
      radius={5}
      pathOptions={{
        color:       '#06090F',
        fillColor:   '#E8A020',
        fillOpacity: 1,
        weight:      2,
      }}
    >
      <Popup>
        <div style={{ fontFamily: 'Geist, sans-serif', minWidth: 140 }}>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, color: '#1A2533' }}>
            {stop.name}
          </p>
          <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#5A6A7E', margin: 0 }}>
            {stop.code}
          </p>
          {stop.address && (
            <p style={{ fontSize: 11, marginTop: 4, color: '#5A6A7E', margin: '4px 0 0' }}>
              {stop.address}
            </p>
          )}
        </div>
      </Popup>
    </CircleMarker>
  )
}

export default function MapView() {
  const { data: wsData, isConnected } = useWebSocket('/ws/positions')
  const [busPositions, setBusPositions] = useState({})

  const { data: stops = [] } = useQuery({ queryKey: ['stops'],  queryFn: fetchStops  })
  const { data: routes = [] } = useQuery({ queryKey: ['routes'], queryFn: fetchRoutes })

  useEffect(() => {
    if (!wsData) return
    const positions = Array.isArray(wsData) ? wsData : [wsData]
    setBusPositions((prev) => {
      const next = { ...prev }
      positions.forEach((p) => {
        if (p.vehicle_id && p.lat && p.lng) next[p.vehicle_id] = p
      })
      return next
    })
  }, [wsData])

  const busArray  = Object.values(busPositions)
  const validStops = stops.filter((s) => s.lat && s.lng)

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'Geist, sans-serif' }}
          >
            Live Map
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Real-time GPS positions of the active fleet
          </p>
        </div>

        {/* Connection status */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{
            backgroundColor: isConnected ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.12)',
            color:           isConnected ? '#34D399'               : '#FBBF24',
            border:          `1px solid ${isConnected ? 'rgba(52,211,153,0.25)' : 'rgba(251,191,36,0.25)'}`,
          }}
        >
          {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {isConnected ? 'WebSocket connected' : 'Reconnecting...'}
        </div>
      </div>

      {/* ── Main layout: map + side panel ──────────────────────────── */}
      <div className="flex flex-col xl:flex-row gap-4">
        {/* Map */}
        <div
          className="flex-1 rounded-xl overflow-hidden"
          style={{
            height: 560,
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <MapContainer
            center={SP_CENTER}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            zoomControl
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
              maxZoom={19}
            />

            {/* Route polylines */}
            {Object.entries(ROUTE_POLYLINES).map(([code, positions]) => (
              <Polyline
                key={code}
                positions={positions}
                pathOptions={{
                  color:   ROUTE_COLORS[code] ?? '#E8A020',
                  weight:  3,
                  opacity: 0.75,
                }}
              />
            ))}

            {/* Stop markers — loaded from API (match seeder coords) */}
            {validStops.map((stop) => (
              <StopMarker key={stop.id} stop={stop} />
            ))}

            {/* Bus markers from WebSocket */}
            {busArray.map((bus) => (
              <BusMarker
                key={bus.vehicle_id}
                position={[bus.lat, bus.lng]}
                vehicleCode={bus.vehicle_code ?? bus.vehicle_id?.slice(0, 8)}
                speed={bus.speed_kmh}
                timestamp={bus.timestamp}
              />
            ))}
          </MapContainer>
        </div>

        {/* Side panel */}
        <div
          className="xl:w-72 rounded-xl p-4"
          style={{
            backgroundColor: 'var(--color-surface)',
            border:          '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Bus size={16} style={{ color: '#E8A020' }} />
            <h2
              className="text-sm font-semibold"
              style={{ color: 'var(--color-text-primary)', fontFamily: 'Geist, sans-serif' }}
            >
              Active Buses
            </h2>
            <span
              className="ml-auto text-xs font-mono font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: '#E8A020', color: '#06090F' }}
            >
              {busArray.length}
            </span>
          </div>

          {busArray.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Bus size={28} style={{ color: 'rgba(224,234,255,0.10)' }} />
              <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
                {isConnected ? 'Waiting for GPS positions...' : 'WebSocket not connected'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 460 }}>
              {busArray.map((bus) => (
                <div
                  key={bus.vehicle_id}
                  className="flex flex-col gap-1 p-3 rounded-lg"
                  style={{ border: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {bus.vehicle_code ?? bus.vehicle_id?.slice(0, 10)}
                    </span>
                    <span className="text-xs font-mono font-semibold" style={{ color: '#34D399' }}>
                      {bus.speed_kmh != null ? `${Math.round(bus.speed_kmh)} km/h` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    <Clock size={11} />
                    {bus.timestamp
                      ? new Date(bus.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : '—'}
                  </div>
                  <div className="text-xs font-mono" style={{ color: 'rgba(224,234,255,0.28)' }}>
                    {bus.lat?.toFixed(5)}, {bus.lng?.toFixed(5)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Legend */}
          <div
            className="mt-4 pt-4 flex flex-col gap-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
              Legend
            </p>
            {Object.entries(ROUTE_COLORS).map(([code, color]) => (
              <div key={code} className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <div className="w-4 h-1 rounded" style={{ backgroundColor: color }} />
                Route {code}
              </div>
            ))}
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#E8A020', border: '2px solid #06090F' }} />
              Stop
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#E8A020' }} />
              Live bus
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
