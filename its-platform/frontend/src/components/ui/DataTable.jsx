import { useState } from 'react'
import { ChevronLeft, ChevronRight, Database } from 'lucide-react'

const PAGE_SIZE = 10

const TH_STYLE = {
  color:         'rgba(224,234,255,0.40)',
  fontSize:      '0.7rem',
  fontWeight:    600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  padding:       '11px 16px',
  textAlign:     'left',
  whiteSpace:    'nowrap',
}

export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No data available',
  pageSize = PAGE_SIZE,
}) {
  const [page, setPage] = useState(0)

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))
  const pageData   = data.slice(page * pageSize, (page + 1) * pageSize)
  const goTo       = (p) => setPage(Math.max(0, Math.min(p, totalPages - 1)))

  const tableStyle = {
    width:          '100%',
    borderCollapse: 'collapse',
    fontSize:       '0.875rem',
    fontFamily:     'Geist, system-ui, sans-serif',
  }

  const wrapperStyle = {
    overflowX:    'auto',
    borderRadius: 10,
    border:       '1px solid rgba(255,255,255,0.07)',
  }

  const theadStyle = {
    backgroundColor: '#060A14',
    borderBottom:    '1px solid rgba(255,255,255,0.07)',
  }

  const renderTh = (col) => (
    <th
      key={col.key}
      style={{
        ...TH_STYLE,
        textAlign: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left',
      }}
    >
      {col.header}
    </th>
  )

  const tdStyle = (rowIdx) => ({
    padding:      '11px 16px',
    color:        'var(--color-text-primary)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    backgroundColor: rowIdx % 2 === 0 ? '#0D1827' : '#0B1520',
  })

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={wrapperStyle}>
        <table style={tableStyle}>
          <thead style={theadStyle}>
            <tr>{columns.map(renderTh)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, rowIdx) => (
              <tr key={rowIdx}>
                {columns.map((col) => (
                  <td key={col.key} style={tdStyle(rowIdx)}>
                    <div className="skeleton h-4 rounded" style={{ width: '65%' }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (data.length === 0) {
    return (
      <div style={wrapperStyle}>
        <table style={tableStyle}>
          <thead style={theadStyle}>
            <tr>{columns.map(renderTh)}</tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={columns.length} style={{ padding: '52px 16px', textAlign: 'center', backgroundColor: '#0D1827' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <Database size={28} style={{ color: 'rgba(224,234,255,0.14)' }} />
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    {emptyMessage}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  // ── Normal ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={wrapperStyle}>
        <table style={tableStyle}>
          <thead style={theadStyle}>
            <tr>{columns.map(renderTh)}</tr>
          </thead>
          <tbody>
            {pageData.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                style={{ cursor: 'default' }}
                onMouseEnter={(e) => {
                  Array.from(e.currentTarget.cells).forEach(
                    (td) => (td.style.backgroundColor = 'rgba(232,160,32,0.05)')
                  )
                }}
                onMouseLeave={(e) => {
                  Array.from(e.currentTarget.cells).forEach(
                    (td) => (td.style.backgroundColor = rowIdx % 2 === 0 ? '#0D1827' : '#0B1520')
                  )
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding:          '11px 16px',
                      color:            'var(--color-text-primary)',
                      borderBottom:     '1px solid rgba(255,255,255,0.04)',
                      backgroundColor:  rowIdx % 2 === 0 ? '#0D1827' : '#0B1520',
                      textAlign:        col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left',
                      transition:       'background-color 100ms ease',
                    }}
                  >
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, data.length)} of {data.length} records
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              onClick={() => goTo(page - 1)}
              disabled={page === 0}
              style={{
                padding:         '4px',
                borderRadius:    6,
                border:          'none',
                backgroundColor: 'transparent',
                color:           page === 0 ? 'rgba(224,234,255,0.15)' : 'rgba(224,234,255,0.55)',
                cursor:          page === 0 ? 'default' : 'pointer',
                transition:      'color 120ms ease',
              }}
              aria-label="Previous page"
            >
              <ChevronLeft size={15} />
            </button>

            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = totalPages <= 7 ? i : Math.max(0, Math.min(i + page - 3, totalPages - 1))
              return (
                <button
                  key={p}
                  onClick={() => goTo(p)}
                  style={{
                    width:           28,
                    height:          28,
                    borderRadius:    6,
                    border:          p === page ? '1px solid rgba(232,160,32,0.30)' : 'none',
                    fontSize:        '0.75rem',
                    fontWeight:      500,
                    cursor:          'pointer',
                    backgroundColor: p === page ? 'rgba(232,160,32,0.12)' : 'transparent',
                    color:           p === page ? '#E8A020' : 'rgba(224,234,255,0.40)',
                    transition:      'background-color 120ms ease',
                  }}
                >
                  {p + 1}
                </button>
              )
            })}

            <button
              onClick={() => goTo(page + 1)}
              disabled={page >= totalPages - 1}
              style={{
                padding:         '4px',
                borderRadius:    6,
                border:          'none',
                backgroundColor: 'transparent',
                color:           page >= totalPages - 1 ? 'rgba(224,234,255,0.15)' : 'rgba(224,234,255,0.55)',
                cursor:          page >= totalPages - 1 ? 'default' : 'pointer',
                transition:      'color 120ms ease',
              }}
              aria-label="Next page"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
