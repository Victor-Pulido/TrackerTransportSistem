import { Bus, LogOut, Menu } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const ROLE_LABELS = {
  superadmin:   'Admin',
  operator:     'Operator',
  fiscalizador: 'Inspector',
  analyst:      'Analyst',
}

const ROLE_COLORS = {
  superadmin:   { bg: 'rgba(109,40,217,0.18)', color: '#C4B5FD' },
  operator:     { bg: 'rgba(30,58,138,0.22)',  color: '#93C5FD' },
  fiscalizador: { bg: 'rgba(232,160,32,0.18)', color: '#E8A020' },
  analyst:      { bg: 'rgba(20,83,45,0.22)',   color: '#86EFAC'  },
}

export default function Topbar({ onMenuToggle }) {
  const { user, role, operatorName, fullName, logout } = useAuth()

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  const roleStyle = ROLE_COLORS[role] ?? { bg: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.60)' }

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-5"
      style={{
        height: 64,
        backgroundColor: '#080D1A',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* ── Left: brand ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-lg transition-colors duration-150"
          style={{ color: 'rgba(255,255,255,0.70)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>

        {/* Logo */}
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ backgroundColor: '#E8A020' }}
        >
          <Bus size={17} color="#0F2540" strokeWidth={2.5} />
        </div>

        {/* Brand text */}
        <div className="hidden sm:flex flex-col leading-tight">
          <span
            className="font-bold tracking-tight"
            style={{ fontSize: '0.875rem', color: '#FFFFFF' }}
          >
            ITS PLATFORM
          </span>
          <span
            className="font-medium tracking-[0.08em] uppercase"
            style={{ fontSize: '0.65rem', color: '#E8A020' }}
          >
            São Paulo
          </span>
        </div>
      </div>

      {/* ── Right: user info ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5">
        {/* Operator name */}
        {operatorName && (
          <span
            className="hidden lg:block text-xs"
            style={{
              color: 'rgba(255,255,255,0.40)',
              paddingRight: '0.75rem',
              borderRight: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            {operatorName}
          </span>
        )}

        {/* Full name */}
        <span className="hidden sm:block text-sm font-medium" style={{ color: '#FFFFFF' }}>
          {fullName || user?.email || 'User'}
        </span>

        {/* Role badge */}
        {role && (
          <span
            className="hidden md:inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full"
            style={{ backgroundColor: roleStyle.bg, color: roleStyle.color }}
          >
            {ROLE_LABELS[role] ?? role}
          </span>
        )}

        {/* Divider */}
        <div
          className="hidden sm:block"
          style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.12)' }}
        />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150"
          style={{ color: 'rgba(255,255,255,0.60)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#FFFFFF'
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.60)'
            e.currentTarget.style.backgroundColor = ''
          }}
          title="Sign out"
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  )
}
