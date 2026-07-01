import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, CheckCircle, AlertCircle, Send } from 'lucide-react'
import client from '../api/client'
import DataTable from '../components/ui/DataTable'

// ── Fetchers ──────────────────────────────────────────────────────────────
const fetchRoutes = async () => {
  const res = await client.get('/api/v1/routes')
  return res.data?.routes ?? res.data ?? []
}

const fetchMyReports = async () => {
  const res = await client.get('/api/v1/reports/passengers')
  return res.data?.reports ?? []
}

const submitReport = async (payload) => {
  const res = await client.post('/api/v1/reports/passengers', payload)
  return res.data
}

// ── Table columns ─────────────────────────────────────────────────────────
const HISTORY_COLUMNS = [
  { key: 'route_code', header: 'Route' },
  { key: 'report_date', header: 'Date',
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
  { key: 'created_at', header: 'Submitted',
    render: (v) => v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—' },
]

// ── Dark field style ──────────────────────────────────────────────────────
const FIELD = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border:          '1px solid rgba(255,255,255,0.10)',
  color:           'var(--color-text-primary)',
  borderRadius:    8,
  padding:         '8px 12px',
  fontSize:        '0.875rem',
  outline:         'none',
  fontFamily:      'Geist, sans-serif',
  width:           '100%',
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function OperatorReports() {
  const qc     = useQueryClient()
  const today  = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    route_id:         '',
    report_date:      today,
    total_passengers: '',
    notes:            '',
  })
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)

  const { data: routes = [], isLoading: loadingRoutes } = useQuery({
    queryKey: ['routes'],
    queryFn:  fetchRoutes,
  })

  const { data: reports = [], isLoading: loadingReports } = useQuery({
    queryKey: ['my-passenger-reports'],
    queryFn:  fetchMyReports,
  })

  const mutation = useMutation({
    mutationFn: submitReport,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-passenger-reports'] })
      setForm({ route_id: '', report_date: today, total_passengers: '', notes: '' })
      setSuccess(true)
      setError(null)
      setTimeout(() => setSuccess(false), 4000)
    },
    onError: (err) => {
      setError(err.response?.data?.error ?? 'Failed to submit report')
      setSuccess(false)
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError(null)
    mutation.mutate({
      route_id:         form.route_id,
      report_date:      form.report_date,
      total_passengers: Number(form.total_passengers),
      notes:            form.notes,
    })
  }

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }))

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <h1
          className="text-xl font-semibold tracking-tight"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'Geist, sans-serif' }}
        >
          Daily Ridership Reports
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          Submit daily passenger counts by route. Reports are compiled and reviewed by CMSP inspectors.
        </p>
      </div>

      {/* ── Submit form ──────────────────────────────────────────────── */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: 'var(--color-surface)',
          border:          '1px solid var(--color-border)',
          boxShadow:       'var(--shadow-card)',
        }}
      >
        <div className="flex items-center gap-2 mb-5">
          <Send size={16} style={{ color: '#E8A020' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Submit Report
          </h2>
        </div>

        {/* Success / Error feedback */}
        {success && (
          <div
            className="flex items-center gap-2.5 p-3.5 rounded-xl mb-4"
            style={{ backgroundColor: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.22)' }}
          >
            <CheckCircle size={15} style={{ color: '#34D399', flexShrink: 0 }} />
            <span className="text-sm" style={{ color: '#34D399' }}>
              Report submitted successfully. It will appear in the history below.
            </span>
          </div>
        )}
        {error && (
          <div
            className="flex items-center gap-2.5 p-3.5 rounded-xl mb-4"
            style={{ backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.22)' }}
          >
            <AlertCircle size={15} style={{ color: '#F87171', flexShrink: 0 }} />
            <span className="text-sm" style={{ color: '#F87171' }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Route selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'rgba(224,234,255,0.68)' }}>
                Route *
              </label>
              <select
                required
                value={form.route_id}
                onChange={(e) => set('route_id', e.target.value)}
                style={FIELD}
              >
                <option value="">Select a route...</option>
                {loadingRoutes && <option disabled>Loading...</option>}
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'rgba(224,234,255,0.68)' }}>
                Report Date *
              </label>
              <input
                type="date"
                required
                value={form.report_date}
                max={today}
                onChange={(e) => set('report_date', e.target.value)}
                style={FIELD}
              />
            </div>

            {/* Passengers */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'rgba(224,234,255,0.68)' }}>
                Total Passengers *
              </label>
              <input
                type="number"
                required
                min={0}
                value={form.total_passengers}
                onChange={(e) => set('total_passengers', e.target.value)}
                placeholder="e.g. 4 820"
                style={FIELD}
              />
              <span className="text-xs" style={{ color: 'rgba(224,234,255,0.30)' }}>
                Total boardings for this route on the selected date
              </span>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'rgba(224,234,255,0.68)' }}>
                Notes
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Optional — incidents, service disruptions..."
                style={FIELD}
              />
            </div>
          </div>

          {/* Info note */}
          <div
            className="flex items-start gap-2 p-3 rounded-lg text-xs"
            style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(224,234,255,0.38)' }}
          >
            <ClipboardList size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            Submitting a report for a route + date combination that already exists will update the existing record.
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold active:scale-[0.98] disabled:opacity-60"
            >
              <Send size={14} />
              {mutation.isPending ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Submission history ───────────────────────────────────────── */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: 'var(--color-surface)',
          border:          '1px solid var(--color-border)',
          boxShadow:       'var(--shadow-card)',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Submission History
          </h2>
        </div>
        <DataTable
          columns={HISTORY_COLUMNS}
          data={reports}
          loading={loadingReports}
          emptyMessage="No reports submitted yet"
        />
      </div>
    </div>
  )
}
