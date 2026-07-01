import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// ── Formatters ────────────────────────────────────────────────────────────────
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

// ── Component ─────────────────────────────────────────────────────────────────
export default function KpiCard({
  title,
  value,
  unit,
  delta,
  deltaLabel,
  icon: Icon,
  format  = 'number',
  size    = 'md',    // 'lg' | 'md'
  warn    = false,
  error   = false,
}) {
  const isLoading = !error && (value === undefined || value === null)
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
    ? 'rgba(224,234,255,0.25)'
    : deltaPositive ? '#4ADE80' : '#F87171'

  // Warn (infraction) vs normal color schemes
  const accentText  = warn ? '#F87171'                 : 'rgba(224,234,255,0.96)'
  const borderIdle  = warn ? 'rgba(248,113,113,0.18)'  : 'rgba(255,255,255,0.06)'
  const bgIdle      = warn ? 'rgba(248,113,113,0.04)'  : 'rgba(255,255,255,0.02)'
  const borderHover = warn ? 'rgba(248,113,113,0.30)'  : 'rgba(255,255,255,0.10)'
  const bgHover     = warn ? 'rgba(248,113,113,0.07)'  : 'rgba(255,255,255,0.035)'
  const iconColor   = warn ? 'rgba(248,113,113,0.60)'  : 'rgba(94,234,212,0.50)'   // teal accent
  const labelColor  = warn ? 'rgba(248,113,113,0.65)'  : 'rgba(224,234,255,0.38)'

  const cardStyle = {
    backgroundColor: bgIdle,
    border:          `1px solid ${borderIdle}`,
    borderRadius:    18,           // elevated from 8 → 18 for modern SaaS feel
    padding:         isLg ? '24px 26px' : '18px 20px',
    display:         'flex',
    flexDirection:   'column',
    gap:             isLg ? 20 : 14,
    height:          '100%',
    boxSizing:       'border-box',
    transition:      'background-color 180ms ease-out, border-color 180ms ease-out, box-shadow 180ms ease-out, transform 180ms ease-out',
    cursor:          'default',
  }

  const onEnter = (e) => {
    const el = e.currentTarget
    el.style.backgroundColor = bgHover
    el.style.borderColor     = borderHover
    el.style.transform       = 'translateY(-1px)'
    el.style.boxShadow       = warn
      ? '0 6px 28px rgba(248,113,113,0.12)'
      : '0 6px 28px rgba(0,0,0,0.28)'
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {Icon && (
          <Icon size={13} strokeWidth={1.7} style={{ color: iconColor, flexShrink: 0 }} />
        )}
        <span style={{
          fontSize:      11,
          fontWeight:    500,
          letterSpacing: '0.06em',
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
          <div className="skeleton" style={{ height: isLg ? 48 : 32, width: '60%', borderRadius: 6 }} />
          <div className="skeleton" style={{ height: 12, width: '35%', borderRadius: 4 }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

          {/* Number + unit */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
            <span style={{
              fontSize:           isLg ? 40 : 26,
              fontWeight:         isLg ? 700 : 600,
              lineHeight:         1,
              fontFamily:         'Geist Mono, monospace',
              letterSpacing:      '-0.03em',
              color:              warn ? accentText : 'rgba(224,234,255,0.96)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatValue(value)}
            </span>
            {unit && (
              <span style={{
                fontSize:   13,
                fontWeight: 400,
                color:      'rgba(224,234,255,0.32)',
                fontFamily: 'Geist, sans-serif',
              }}>
                {unit}
              </span>
            )}
          </div>

          {/* Delta badge */}
          {delta != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                display:       'inline-flex',
                alignItems:    'center',
                gap:           3,
                fontSize:      11,
                fontWeight:    500,
                color:         deltaColor,
                fontFamily:    'Geist Mono, monospace',
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
                  fontSize:   11,
                  color:      'rgba(224,234,255,0.20)',
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
