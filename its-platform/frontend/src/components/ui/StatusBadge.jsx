const STATUS_MAP = {
  // Severity
  HIGH:         { label: 'High',        bg: 'rgba(248,113,113,0.12)', color: '#F87171', border: 'rgba(248,113,113,0.25)' },
  MEDIUM:       { label: 'Medium',      bg: 'rgba(251,191,36,0.12)',  color: '#FBBF24', border: 'rgba(251,191,36,0.25)'  },
  LOW:          { label: 'Low',         bg: 'rgba(52,211,153,0.12)',  color: '#34D399', border: 'rgba(52,211,153,0.25)'  },

  // Trip / service status
  COMPLETED:    { label: 'Completed',   bg: 'rgba(52,211,153,0.12)',  color: '#34D399', border: 'rgba(52,211,153,0.25)'  },
  IN_PROGRESS:  { label: 'In Progress', bg: 'rgba(96,165,250,0.12)',  color: '#60A5FA', border: 'rgba(96,165,250,0.25)'  },
  SCHEDULED:    { label: 'Scheduled',   bg: 'rgba(224,234,255,0.07)', color: 'rgba(224,234,255,0.55)', border: 'rgba(224,234,255,0.12)' },
  CANCELLED:    { label: 'Cancelled',   bg: 'rgba(248,113,113,0.12)', color: '#F87171', border: 'rgba(248,113,113,0.25)' },

  // Infraction types
  FREQUENCY:    { label: 'Frequency',   bg: 'rgba(251,191,36,0.12)',  color: '#FBBF24', border: 'rgba(251,191,36,0.25)'  },
  OVERCAPACITY: { label: 'Overcapacity',bg: 'rgba(248,113,113,0.12)', color: '#F87171', border: 'rgba(248,113,113,0.25)' },
  NO_SHOW:      { label: 'No-Show',     bg: 'rgba(167,139,250,0.12)', color: '#A78BFA', border: 'rgba(167,139,250,0.25)' },

  // Financial
  DAILY_REVENUE: { label: 'Daily Revenue', bg: 'rgba(96,165,250,0.12)',  color: '#60A5FA', border: 'rgba(96,165,250,0.25)'  },
  SUBSIDY:       { label: 'Subsidy',       bg: 'rgba(52,211,153,0.12)',  color: '#34D399', border: 'rgba(52,211,153,0.25)'  },
  PENALTY:       { label: 'Penalty',       bg: 'rgba(248,113,113,0.12)', color: '#F87171', border: 'rgba(248,113,113,0.25)' },
  ADJUSTMENT:    { label: 'Adjustment',    bg: 'rgba(224,234,255,0.07)', color: 'rgba(224,234,255,0.55)', border: 'rgba(224,234,255,0.12)' },
}

export default function StatusBadge({ status }) {
  const cfg = STATUS_MAP[status] ?? {
    label:  status ?? '—',
    bg:     'rgba(224,234,255,0.06)',
    color:  'rgba(224,234,255,0.50)',
    border: 'rgba(224,234,255,0.10)',
  }

  return (
    <span
      className="inline-flex items-center whitespace-nowrap font-semibold"
      style={{
        backgroundColor: cfg.bg,
        color:           cfg.color,
        border:          `1px solid ${cfg.border}`,
        borderRadius:    5,
        fontSize:        '0.69rem',
        letterSpacing:   '0.04em',
        padding:         '2px 7px',
      }}
    >
      {cfg.label}
    </span>
  )
}
