import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Map,
  BarChart2,
  ShieldCheck,
  DollarSign,
  ClipboardList,
  Bus,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const NAV_ITEMS = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard',        roles: null },
  { to: '/map',           icon: Map,             label: 'Live Map',         roles: null },
  { to: '/analytics',     icon: BarChart2,       label: 'Analytics',        roles: null },
  { to: '/fiscalization', icon: ShieldCheck,     label: 'Fiscalization',    roles: ['fiscalizador', 'superadmin'] },
  { to: '/reports',       icon: ClipboardList,   label: 'Ridership Reports',roles: ['operator', 'superadmin'] },
  { to: '/financial',     icon: DollarSign,      label: 'Financial',        roles: null },
]

export default function Sidebar({ isOpen, onClose }) {
  const { role } = useAuth()

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role)
  )

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={[
          'fixed top-16 left-0 bottom-0 z-40 flex flex-col',
          'transition-transform duration-200 ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0',
        ].join(' ')}
        style={{ width: 240, backgroundColor: '#070C18', borderRight: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5">
          <div
            style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.22)',
              padding: '0.25rem 0.75rem 0.6rem',
            }}
          >
            Navigation
          </div>
          {visibleItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={17} strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom divider */}
        <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', margin: '0 12px' }} />

        {/* Brand footer */}
        <div className="px-3.5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0"
              style={{ backgroundColor: 'rgba(232,160,32,0.15)' }}
            >
              <Bus size={13} style={{ color: '#E8A020' }} strokeWidth={2.5} />
            </div>
            <div>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.45)',
                  letterSpacing: '0.06em',
                  lineHeight: 1.2,
                }}
              >
                ITS PLATFORM
              </div>
              <div
                style={{
                  fontSize: '0.62rem',
                  color: 'rgba(255,255,255,0.20)',
                  letterSpacing: '0.03em',
                  lineHeight: 1.4,
                }}
              >
                São Paulo · Demo
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
