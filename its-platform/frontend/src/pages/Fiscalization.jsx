import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, AlertTriangle, Plus, X, CheckCircle, ClipboardList } from 'lucide-react'
import client from '../api/client'
import DataTable   from '../components/ui/DataTable'
import StatusBadge from '../components/ui/StatusBadge'
import { useAuth }  from '../hooks/useAuth'

// ── Fetchers / mutators ───────────────────────────────────────────────────
const fetchCompliance = async () => {
  const res = await client.get('/api/v1/fiscalization/compliance')
  return res.data?.route_results ?? []
}

const fetchInfractions = async (filters) => {
  const params = new URLSearchParams()
  if (filters.operator)       params.set('operator_id', filters.operator)
  if (filters.severity)       params.set('severity',    filters.severity)
  if (filters.type)           params.set('type',        filters.type)
  if (filters.resolved !== '') params.set('resolved',   filters.resolved)
  const res = await client.get(`/api/v1/fiscalization/infractions?${params}`)
  return res.data?.infractions ?? res.data ?? []
}

const fetchOperators = async () => {
  const res = await client.get('/api/v1/operators')
  return res.data?.operators ?? res.data ?? []
}

const fetchVehicles = async () => {
  const res = await client.get('/api/v1/vehicles')
  return res.data?.vehicles ?? res.data ?? []
}

const fetchRoutes = async () => {
  const res = await client.get('/api/v1/routes')
  return res.data?.routes ?? res.data ?? []
}

const fetchPassengerReports = async (opFilter, from, to) => {
  const params = new URLSearchParams()
  if (opFilter) params.set('operator_id', opFilter)
  if (from)     params.set('from', from)
  if (to)       params.set('to', to)
  const res = await client.get(`/api/v1/reports/passengers?${params}`)
  return res.data?.reports ?? []
}

const resolveInfraction = async (id) => {
  const res = await client.patch(`/api/v1/fiscalization/infractions/${id}/resolve`)
  return res.data
}

const createInfraction = async (payload) => {
  const res = await client.post('/api/v1/fiscalization/infractions', payload)
  return res.data
}

// ── Compliance table columns ──────────────────────────────────────────────
const COMPLIANCE_COLUMNS = [
  { key: 'operator_name',  header: 'Operator' },
  { key: 'route_code',     header: 'Route' },
  { key: 'min_daily_trips',header: 'Contracted Trips', align: 'right',
    render: (v) => <span className="font-mono">{Number(v ?? 0).toLocaleString('pt-BR')}</span> },
  { key: 'actual_trips',   header: 'Completed',        align: 'right',
    render: (v) => <span className="font-mono">{Number(v ?? 0).toLocaleString('pt-BR')}</span> },
  {
    key:    'compliance_pct',
    header: 'Compliance',
    render: (v) => {
      const pct   = Number(v ?? 0)
      const color = pct >= 90 ? '#34D399' : pct >= 70 ? '#FBBF24' : '#F87171'
      return (
        <div className="flex items-center gap-2">
          <div
            className="flex-1 rounded-full overflow-hidden"
            style={{ height: 5, backgroundColor: 'rgba(255,255,255,0.07)', minWidth: 60 }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
            />
          </div>
          <span
            className="font-mono font-semibold text-xs w-12 text-right tabular-nums"
            style={{ color }}
          >
            {pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
          </span>
        </div>
      )
    },
  },
]

// ── Infraction table columns factory ─────────────────────────────────────
function getInfractionColumns(onResolve) {
  return [
    { key: 'operator_name', header: 'Operator' },
    { key: 'route_code',    header: 'Route' },
    { key: 'vehicle_code',  header: 'Vehicle' },
    { key: 'type',          header: 'Type',     render: (v) => <StatusBadge status={v} /> },
    { key: 'severity',      header: 'Severity', render: (v) => <StatusBadge status={v} /> },
    { key: 'description',   header: 'Description',
      render: (v) => (
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {v ?? '—'}
        </span>
      ) },
    { key: 'detected_at', header: 'Detected',
      render: (v) => v ? new Date(v).toLocaleDateString('pt-BR') : '—' },
    {
      key:    'resolved',
      header: 'Status',
      render: (v, row) =>
        v || v === 1 ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: '#34D399' }}>
            <CheckCircle size={12} /> Resolved
          </span>
        ) : (
          <button
            onClick={() => onResolve(row.id)}
            className="px-2.5 py-1 rounded text-xs font-semibold transition-all duration-150 active:scale-[0.98]"
            style={{
              backgroundColor: 'rgba(232,160,32,0.12)',
              color:           '#E8A020',
              border:          '1px solid rgba(232,160,32,0.25)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(232,160,32,0.22)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(232,160,32,0.12)')}
          >
            Mark resolved
          </button>
        ),
    },
  ]
}

// ── Passenger reports columns ─────────────────────────────────────────────
const REPORTS_COLUMNS = [
  { key: 'operator_name', header: 'Operator' },
  { key: 'route_code',    header: 'Route' },
  { key: 'report_date',   header: 'Date',
    render: (v) => v ? new Date(v + 'T00:00:00').toLocaleDateString('pt-BR') : '—' },
  { key: 'total_passengers', header: 'Passengers', align: 'right',
    render: (v) => (
      <span className="font-mono font-semibold" style={{ color: '#E8A020' }}>
        {Number(v ?? 0).toLocaleString('pt-BR')}
      </span>
    ) },
  { key: 'notes', header: 'Notes',
    render: (v) => (
      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {v || '—'}
      </span>
    ) },
]

// ── Dark input style ──────────────────────────────────────────────────────
const FIELD_STYLE = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border:          '1px solid rgba(255,255,255,0.10)',
  color:           'var(--color-text-primary)',
  borderRadius:    8,
  padding:         '7px 12px',
  fontSize:        '0.875rem',
  outline:         'none',
  fontFamily:      'Geist, sans-serif',
  width:           '100%',
}

// ── Register Infraction Modal ─────────────────────────────────────────────
function InfractionModal({ onClose, operators, vehicles, routes }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    operator_id: '',
    vehicle_id:  '',
    route_id:    '',
    type:        'FREQUENCY',
    description: '',
    severity:    'MEDIUM',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState(null)

  const handleChange = (field, val) =>
    setForm((prev) => ({ ...prev, [field]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await createInfraction(form)
      qc.invalidateQueries({ queryKey: ['infractions'] })
      onClose()
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to register infraction')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
    >
      <div
        className="w-full max-w-lg rounded-xl overflow-hidden"
        style={{
          backgroundColor: '#0D1827',
          border:          '1px solid rgba(255,255,255,0.10)',
          boxShadow:       '0 24px 64px rgba(0,0,0,0.55)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{
            backgroundColor: 'rgba(232,160,32,0.07)',
            borderBottom:    '1px solid rgba(232,160,32,0.15)',
          }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={17} style={{ color: '#E8A020' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#E0EAFF' }}>
              Register Infraction
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'rgba(224,234,255,0.38)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#E0EAFF')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(224,234,255,0.38)')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {error && (
            <div
              className="text-sm px-3 py-2.5 rounded-lg"
              style={{
                backgroundColor: 'rgba(248,113,113,0.08)',
                border:          '1px solid rgba(248,113,113,0.22)',
                color:           '#F87171',
              }}
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {[
              {
                label: 'Operator *', field: 'operator_id', required: true,
                options: [{ value: '', label: 'Select...' }, ...operators.map((o) => ({ value: o.id, label: o.name }))],
              },
              {
                label: 'Vehicle', field: 'vehicle_id', required: false,
                options: [{ value: '', label: 'Select...' }, ...vehicles.map((v) => ({ value: v.id, label: `${v.license_plate} (${v.internal_code})` }))],
              },
              {
                label: 'Route', field: 'route_id', required: false,
                options: [{ value: '', label: 'Select...' }, ...routes.map((r) => ({ value: r.id, label: `${r.code} — ${r.name}` }))],
              },
              {
                label: 'Type *', field: 'type', required: true,
                options: [
                  { value: 'FREQUENCY',    label: 'Frequency'    },
                  { value: 'OVERCAPACITY', label: 'Overcapacity' },
                  { value: 'NO_SHOW',      label: 'No-Show'      },
                ],
              },
            ].map(({ label, field, required, options }) => (
              <div key={field} className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'rgba(224,234,255,0.55)' }}>
                  {label}
                </label>
                <select
                  required={required}
                  value={form[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  style={FIELD_STYLE}
                >
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Severity */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'rgba(224,234,255,0.55)' }}>
              Severity *
            </label>
            <div className="flex gap-2">
              {[
                { key: 'LOW',    label: 'Low',    color: '#34D399' },
                { key: 'MEDIUM', label: 'Medium', color: '#FBBF24' },
                { key: 'HIGH',   label: 'High',   color: '#F87171' },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => handleChange('severity', s.key)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-150"
                  style={{
                    backgroundColor: form.severity === s.key ? `${s.color}20` : 'rgba(255,255,255,0.03)',
                    color:           form.severity === s.key ? s.color : 'rgba(224,234,255,0.35)',
                    border:          `1px solid ${form.severity === s.key ? `${s.color}55` : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'rgba(224,234,255,0.55)' }}>
              Description *
            </label>
            <textarea
              required
              rows={3}
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe the infraction detected..."
              style={{ ...FIELD_STYLE, resize: 'none', lineHeight: 1.5 }}
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.98]"
              style={{
                border:          '1px solid rgba(255,255,255,0.10)',
                color:           'rgba(224,234,255,0.55)',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary px-5 py-2 text-sm font-semibold active:scale-[0.98] disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Register Infraction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Passenger Reports compiled view ──────────────────────────────────────
function ReportsSection({ operators }) {
  const [opFilter, setOpFilter] = useState('')
  const today  = new Date().toISOString().slice(0, 10)
  const week   = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const [from, setFrom] = useState(week)
  const [to,   setTo]   = useState(today)

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['passenger-reports-fisc', opFilter, from, to],
    queryFn:  () => fetchPassengerReports(opFilter, from, to),
  })

  const totalPassengers = reports.reduce((s, r) => s + (r.total_passengers ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      {/* KPI total */}
      <div
        className="rounded-xl p-5 flex items-center gap-4"
        style={{
          backgroundColor: 'rgba(232,160,32,0.06)',
          border: '1px solid rgba(232,160,32,0.18)',
        }}
      >
        <ClipboardList size={24} style={{ color: '#E8A020' }} />
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(232,160,32,0.70)' }}>
            Total Passengers — Compiled
          </div>
          <div className="font-mono font-bold tabular-nums" style={{ fontSize: '2rem', color: '#E8A020', lineHeight: 1.1 }}>
            {totalPassengers.toLocaleString('pt-BR')}
          </div>
          <div className="text-xs" style={{ color: 'rgba(224,234,255,0.40)' }}>
            {reports.length} report{reports.length !== 1 ? 's' : ''} from {from} to {to}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        className="rounded-xl p-4 flex flex-wrap gap-3 items-end"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Operator</label>
          <select
            value={opFilter}
            onChange={(e) => setOpFilter(e.target.value)}
            style={{ ...FIELD_STYLE, minWidth: 160, width: 'auto' }}
          >
            <option value="">All operators</option>
            {operators.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ ...FIELD_STYLE, width: 150 }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ ...FIELD_STYLE, width: 150 }}
          />
        </div>

        <button
          onClick={() => { setOpFilter(''); setFrom(week); setTo(today) }}
          className="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
          style={{
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(224,234,255,0.50)',
            backgroundColor: 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          Reset
        </button>
      </div>

      {/* Table */}
      <div
        className="rounded-xl p-6"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <DataTable
          columns={REPORTS_COLUMNS}
          data={reports}
          loading={isLoading}
          emptyMessage="No passenger reports in this period"
        />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'compliance',  label: 'Compliance'  },
  { id: 'infractions', label: 'Infractions' },
  { id: 'reports',     label: 'Reports'     },
]

export default function Fiscalization() {
  const { role } = useAuth()
  const qc       = useQueryClient()

  const [activeSection, setActiveSection] = useState('compliance')
  const [showModal,     setShowModal]     = useState(false)
  const [filters,       setFilters]       = useState({
    operator: '',
    severity: '',
    type:     '',
    resolved: '',
  })

  const { data: compliance = [],  isLoading: loadingComp } = useQuery({
    queryKey: ['compliance'],
    queryFn:  fetchCompliance,
  })

  const { data: infractions = [], isLoading: loadingInfr } = useQuery({
    queryKey: ['infractions', filters],
    queryFn:  () => fetchInfractions(filters),
  })

  const { data: operators = [] } = useQuery({
    queryKey: ['operators'],
    queryFn:  fetchOperators,
  })

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn:  fetchVehicles,
  })

  const { data: routes = [] } = useQuery({
    queryKey: ['routes'],
    queryFn:  fetchRoutes,
  })

  const resolveMutation = useMutation({
    mutationFn: resolveInfraction,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['infractions'] }),
  })

  const infractionColumns = getInfractionColumns((id) => resolveMutation.mutate(id))

  if (role !== 'fiscalizador' && role !== 'superadmin') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <ShieldCheck size={48} style={{ color: 'rgba(224,234,255,0.14)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Restricted access. Inspector role required.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'Geist, sans-serif' }}
          >
            Fiscalization Panel
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            Contract compliance, infractions and ridership reports
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold active:scale-[0.98]"
        >
          <Plus size={15} />
          Register Infraction
        </button>
      </div>

      {/* ── Section tabs ─────────────────────────────────────────────── */}
      <div
        className="flex gap-1 p-1 rounded-xl"
        style={{
          backgroundColor: 'var(--color-surface)',
          border:          '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.98]"
            style={{
              backgroundColor: activeSection === s.id ? 'rgba(232,160,32,0.14)' : 'transparent',
              color:           activeSection === s.id ? '#E8A020' : 'rgba(224,234,255,0.42)',
              border:          activeSection === s.id ? '1px solid rgba(232,160,32,0.28)' : '1px solid transparent',
            }}
            onMouseEnter={(e) => {
              if (activeSection !== s.id) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'
            }}
            onMouseLeave={(e) => {
              if (activeSection !== s.id) e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Compliance section ───────────────────────────────────────── */}
      {activeSection === 'compliance' && (
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: 'var(--color-surface)',
            border:          '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div className="mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Compliance by Operator and Route
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              Contracted vs. completed trips — current period
            </p>
          </div>
          <DataTable
            columns={COMPLIANCE_COLUMNS}
            data={compliance}
            loading={loadingComp}
            emptyMessage="No compliance data available"
          />
        </div>
      )}

      {/* ── Infractions section ──────────────────────────────────────── */}
      {activeSection === 'infractions' && (
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <div
            className="rounded-xl p-4 flex flex-wrap gap-3 items-end"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            {[
              {
                label: 'Operator', key: 'operator', minWidth: 160,
                options: [
                  { value: '', label: 'All' },
                  ...operators.map((o) => ({ value: o.id, label: o.name })),
                ],
              },
              {
                label: 'Severity', key: 'severity', minWidth: 120,
                options: [
                  { value: '',       label: 'All'    },
                  { value: 'HIGH',   label: 'High'   },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'LOW',    label: 'Low'    },
                ],
              },
              {
                label: 'Type', key: 'type', minWidth: 140,
                options: [
                  { value: '',             label: 'All'          },
                  { value: 'FREQUENCY',    label: 'Frequency'    },
                  { value: 'OVERCAPACITY', label: 'Overcapacity' },
                  { value: 'NO_SHOW',      label: 'No-Show'      },
                ],
              },
              {
                label: 'Status', key: 'resolved', minWidth: 120,
                options: [
                  { value: '',  label: 'All'     },
                  { value: '0', label: 'Open'    },
                  { value: '1', label: 'Resolved'},
                ],
              },
            ].map(({ label, key, minWidth, options }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  {label}
                </label>
                <select
                  value={filters[key]}
                  onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
                  style={{ ...FIELD_STYLE, minWidth, width: 'auto' }}
                >
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ))}

            <button
              onClick={() => setFilters({ operator: '', severity: '', type: '', resolved: '' })}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.98]"
              style={{
                border:          '1px solid rgba(255,255,255,0.10)',
                color:           'rgba(224,234,255,0.50)',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Clear
            </button>
          </div>

          {/* Table */}
          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <DataTable
              columns={infractionColumns}
              data={infractions}
              loading={loadingInfr}
              emptyMessage="No infractions match the selected filters"
            />
          </div>
        </div>
      )}

      {/* ── Reports section ──────────────────────────────────────────── */}
      {activeSection === 'reports' && (
        <ReportsSection operators={operators} />
      )}

      {/* ── Modal ────────────────────────────────────────────────────── */}
      {showModal && (
        <InfractionModal
          onClose={() => setShowModal(false)}
          operators={operators}
          vehicles={vehicles}
          routes={routes}
        />
      )}
    </div>
  )
}
