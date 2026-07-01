import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// ── Formatters ────────────────────────────────────────────────────────────
const formatBRL = (v) =>
  Number(v).toLocaleString('pt-BR', {
    style:                 'currency',
    currency:              'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

const formatPct = (v) =>
  `${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

const formatNum = (v) => Number(v).toLocaleString('pt-BR')

// ── Component ─────────────────────────────────────────────────────────────
export default function KpiCard({
  title,
  value,
  unit,
  delta,
  deltaLabel,
  icon: Icon,
  format  = 'number',
  size    = 'md',   // 'lg' | 'md'
  warn    = false,  // activates error/warning treatment
}) {
  const isLoading = value === undefined || value === null
  const isLg      = size === 'lg'

  const formatValue = (v) => {
    if (v == null) return '—'
    if (format === 'currency') return formatBRL(v)
    if (format === 'percent')  return formatPct(v)
    return formatNum(v)
  }

  const deltaPositive = delta > 0
  const deltaNeutral  = delta === 0 || delta == null
  const deltaColor    = deltaNeutral
    ? 'rgba(224,234,255,0.28)'
    : deltaPositive ? '#4ADE80' : '#F87171'

  const accentText  = warn ? '#F87171'                   : 'var(--color-text-primary)'
  const borderIdle  = warn ? 'rgba(248,113,113,0.20)'   : 'rgba(255,255,255,0.07)'
  const bgIdle      = warn ? 'rgba(248,113,113,0.04)'   : 'rgba(255,255,255,0.025)'
  const borderHover = warn ? 'rgba(248,113,113,0.32)'   : 'rgba(255,255,255,0.12)'
  const bgHover     = warn ? 'rgba(248,113,113,0.07)'   : 'rgba(255,255,255,0.04)'
  const iconColor   = warn ? 'rgba(248,113,113,0.65)'   : 'rgba(224,234,255,0.35)'
  const labelColor  = warn ? 'rgba(248,113,113,0.70)'   : 'rgba(224,234,255,0.45)'

  const cardStyle = {
    backgroundColor: bgIdle,
    border:          `1px solid ${borderIdle}`,
    borderRadius:    8,
    padding:         isLg ? '22px 24px' : '16px 20px',
    display:         'flex',
    flexDirection:   'column',
    gap:             isLg ? 18 : 12,
    height:          '100%',
    boxSizing:       'border-box',
    transition:      'background-color 150ms ease-out, border-color 150ms ease-out, box-shadow 150ms ease-out, transform 150ms ease-out',
    cursor:          'default',
  }

  const onEnter = (e) => {
    const el = e.currentTarget
    el.style.backgroundColor = bgHover
    el.style.borderColor     = borderHover
    el.style.transform       = 'translateY(-1px)'
    el.style.boxShadow       = warn
      ? '0 4px 20px rgba(248,113,113,0.10)'
      : '0 4px 20px rgba(0,0,0,0.30)'
  }
  const onLeave = (e) => {
    const el = e.currentTarget
    el.style.backgroundColor = bgIdle
    el.style.borderColor     = borderIdle
    el.style.transform       = ''
    el.style.boxShadow       = ''
  }

  return (
    <div style={cardStyle} onMouseEnter={onEnter} onMouseLeave={onLeave}>

      {/* ── Label row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {Icon && (
          <Icon size={12} strokeWidth={1.8} style={{ color: iconColor, flexShrink: 0 }} />
        )}
        <span style={{
          fontSize:      11,
          fontWeight:    500,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color:         labelColor,
          fontFamily:    'Geist, sans-serif',
          lineHeight:    1,
        }}>
          {title}
        </span>
      </div>

      {/* ── Value area ── */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skeleton" style={{ height: isLg ? 44 : 30, width: '58%', borderRadius: 4 }} />
          <div className="skeleton" style={{ height: 13, width: '32%', borderRadius: 4 }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

          {/* Number + unit */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize:           isLg ? 36 : 24,
              fontWeight:         isLg ? 700 : 600,
              lineHeight:         1,
              fontFamily:         'Geist Mono, monospace',
              letterSpacing:      '-0.025em',
              color:              warn ? accentText : 'var(--color-text-primary)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatValue(value)}
            </span>
            {unit && (
              <span style={{
                fontSize:   13,
                fontWeight: 400,
                color:      'rgba(224,234,255,0.38)',
                fontFamily: 'Geist, sans-serif',
              }}>
                {unit}
              </span>
            )}
          </div>

          {/* Delta */}
          {delta != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                display:    'inline-flex',
                alignItems: 'center',
                gap:        3,
                fontSize:   12,
                fontWeight: 500,
                color:      deltaColor,
                fontFamily: 'Geist Mono, monospace',
                letterSpacing: '-0.01em',
              }}>
                {deltaNeutral
                  ? <Minus size={10} strokeWidth={2} />
                  : deltaPositive
                  ? <TrendingUp  size={10} strokeWidth={2} />
                  : <TrendingDown size={10} strokeWidth={2} />
                }
                {!deltaNeutral && (deltaPositive ? '+' : '')}
                {Math.abs(delta).toLocaleString('pt-BR', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}%
              </span>
              {deltaLabel && (
                <span style={{
                  fontSize:   12,
                  color:      'rgba(224,234,255,0.25)',
                  fontFamily: 'Geist, sans-serif',
                }}>
                  {deltaLabel}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
