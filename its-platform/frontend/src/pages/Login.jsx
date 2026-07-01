import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bus, Eye, EyeOff, AlertCircle, ArrowRight, Activity, MapPin, ShieldCheck } from 'lucide-react'
import client from '../api/client'
import useAuthStore from '../store/authStore'

const DEMO_USERS = [
  { email: 'admin@spmove.com.br',          password: 'Admin2026!', label: 'Super Admin'    },
  { email: 'operator@spmove-norte.com.br', password: 'Oper2026!',  label: 'Operator Norte' },
  { email: 'analyst@spmove-norte.com.br',  password: 'Anal2026!',  label: 'Analyst Norte'  },
  { email: 'operator@spmove-sul.com.br',   password: 'Oper2026!',  label: 'Operator Sul'   },
  { email: 'inspector@cmsp.sp.gov.br',     password: 'Insp2026!',  label: 'CMSP Inspector' },
]

const FEATURES = [
  { icon: Activity,    text: 'Real-time fleet monitoring'        },
  { icon: MapPin,      text: 'GPS tracking per vehicle'          },
  { icon: ShieldCheck, text: 'Automated compliance inspection'   },
]

const STATS = [
  { value: '25',  label: 'Vehicles' },
  { value: '3',   label: 'Routes'   },
  { value: '30d', label: 'History'  },
]

export default function Login() {
  const navigate  = useNavigate()
  const { login } = useAuthStore()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await client.post('/auth/login', { email, password })
      const { token, user } = res.data
      login(token, user)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Invalid credentials. Please check your email and password.')
      } else if (err.response?.data?.message) {
        setError(err.response.data.message)
      } else {
        setError('Could not connect to the server. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (u) => {
    setEmail(u.email)
    setPassword(u.password)
    setError(null)
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#06090F' }}>

      {/* ── Left panel ────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between p-14 flex-1 relative overflow-hidden"
        style={{ background: 'linear-gradient(150deg, #06090F 0%, #09121E 100%)' }}
      >
        {/* Grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.026) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.026) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Amber radial glow — bottom left */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 8% 88%, rgba(232,160,32,0.20) 0%, transparent 52%)',
          }}
        />

        {/* Blue accent — top right */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 88% 8%, rgba(30,77,140,0.32) 0%, transparent 48%)',
          }}
        />

        {/* Top amber line */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(232,160,32,0.55) 35%, rgba(232,160,32,0.20) 100%)',
          }}
        />

        {/* ── Brand ─────────────────────────────────────────────────── */}
        <div className="relative flex items-center gap-4">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #E8A020 0%, #C88010 100%)',
              boxShadow: '0 0 24px rgba(232,160,32,0.32)',
            }}
          >
            <Bus size={22} color="#06090F" strokeWidth={2.5} />
          </div>
          <div>
            <div
              className="font-bold tracking-widest"
              style={{ fontSize: '0.85rem', color: '#E0EAFF', letterSpacing: '0.12em' }}
            >
              ITS PLATFORM
            </div>
            <div
              className="font-semibold tracking-[0.14em] uppercase"
              style={{ fontSize: '0.62rem', color: '#E8A020' }}
            >
              São Paulo Transit Compliance
            </div>
          </div>
        </div>

        {/* ── Hero content ──────────────────────────────────────────── */}
        <div className="relative flex flex-col gap-10">
          <div>
            {/* Live badge */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
              style={{
                backgroundColor: 'rgba(232,160,32,0.10)',
                border: '1px solid rgba(232,160,32,0.24)',
                color: '#E8A020',
                letterSpacing: '0.08em',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse inline-block"
                style={{ backgroundColor: '#E8A020' }}
              />
              DEMO PLATFORM 2026
            </div>

            <h1
              style={{
                fontSize: '2.6rem',
                fontWeight: 800,
                lineHeight: 1.06,
                letterSpacing: '-0.025em',
                color: '#E0EAFF',
                maxWidth: 420,
              }}
            >
              Regulatory Intelligence for Public Transport
            </h1>
            <p
              className="mt-4 text-base leading-relaxed"
              style={{ color: 'rgba(224,234,255,0.46)', maxWidth: 360 }}
            >
              GPS monitoring, real-time compliance inspection and
              operational analytics — all in one dashboard.
            </p>
          </div>

          {/* Features */}
          <div className="flex flex-col gap-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
                  style={{
                    backgroundColor: 'rgba(232,160,32,0.10)',
                    border: '1px solid rgba(232,160,32,0.18)',
                  }}
                >
                  <Icon size={13} style={{ color: '#E8A020' }} strokeWidth={1.8} />
                </div>
                <span className="text-sm" style={{ color: 'rgba(224,234,255,0.58)' }}>
                  {text}
                </span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div
            className="grid grid-cols-3 rounded-xl overflow-hidden"
            style={{
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className="flex flex-col items-center gap-1.5 py-5"
                style={{
                  borderRight: i < STATS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}
              >
                <span
                  className="font-mono font-bold tabular-nums leading-none"
                  style={{ fontSize: '2rem', color: '#E8A020' }}
                >
                  {s.value}
                </span>
                <span className="text-xs" style={{ color: 'rgba(224,234,255,0.32)' }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div
          className="relative text-xs"
          style={{ color: 'rgba(224,234,255,0.18)', fontFamily: 'Geist Mono, monospace' }}
        >
          ITS Platform · Demo 2026 · São Paulo
        </div>
      </div>

      {/* ── Vertical divider ──────────────────────────────────────────── */}
      <div
        className="hidden lg:block w-px flex-shrink-0"
        style={{
          background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.08) 70%, transparent)',
        }}
      />

      {/* ── Right panel — form ────────────────────────────────────────── */}
      <div
        className="flex-1 lg:max-w-[440px] flex flex-col items-center justify-center p-10 relative"
        style={{ backgroundColor: '#070C16' }}
      >
        {/* Mobile brand */}
        <div className="flex lg:hidden items-center gap-3 mb-10">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl"
            style={{ background: 'linear-gradient(135deg, #E8A020, #C88010)' }}
          >
            <Bus size={20} color="#06090F" strokeWidth={2.5} />
          </div>
          <div>
            <div
              className="font-bold tracking-widest"
              style={{ fontSize: '0.85rem', color: '#E0EAFF' }}
            >
              ITS PLATFORM
            </div>
            <div className="text-xs tracking-wide" style={{ color: '#E8A020' }}>
              São Paulo Transit Compliance
            </div>
          </div>
        </div>

        <div className="w-full max-w-[360px]">
          {/* Header */}
          <div className="mb-8">
            <h2
              style={{
                fontSize: '1.625rem',
                fontWeight: 700,
                color: '#E0EAFF',
                letterSpacing: '-0.02em',
                marginBottom: '0.375rem',
              }}
            >
              Welcome back
            </h2>
            <p className="text-sm" style={{ color: 'rgba(224,234,255,0.42)' }}>
              Sign in with your credentials to access the platform
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-3 p-3.5 rounded-xl mb-6"
              style={{
                backgroundColor: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.22)',
              }}
            >
              <AlertCircle size={15} style={{ color: '#F87171', flexShrink: 0, marginTop: 1 }} />
              <span className="text-sm" style={{ color: '#F87171' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-sm font-medium"
                style={{ color: 'rgba(224,234,255,0.68)' }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com.br"
                className="input-field"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium"
                style={{ color: 'rgba(224,234,255,0.68)' }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="input-field"
                  style={{ paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 transition-colors duration-150"
                  style={{ color: 'rgba(224,234,255,0.32)' }}
                  tabIndex={-1}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                'Signing in...'
              ) : (
                <>
                  Sign in
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Demo credentials — always visible */}
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="h-px flex-1" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
              <span
                className="text-xs font-semibold tracking-[0.08em] uppercase"
                style={{ color: 'rgba(224,234,255,0.24)' }}
              >
                Demo accounts
              </span>
              <div className="h-px flex-1" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
            </div>

            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {DEMO_USERS.map((u, i) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => fillDemo(u)}
                  className="w-full px-4 py-2.5 text-left transition-colors duration-100"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    borderBottom: i < DEMO_USERS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(232,160,32,0.07)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)')}
                >
                  <div className="flex items-center justify-between gap-3 mb-0.5">
                    <span className="text-xs font-semibold" style={{ color: 'rgba(224,234,255,0.65)' }}>
                      {u.label}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: '#E8A020', fontFamily: 'Geist Mono, monospace' }}
                    >
                      {u.password}
                    </span>
                  </div>
                  <span
                    className="text-xs"
                    style={{ color: 'rgba(224,234,255,0.28)', fontFamily: 'Geist Mono, monospace' }}
                  >
                    {u.email}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs mt-2 text-center" style={{ color: 'rgba(224,234,255,0.20)' }}>
              Click any row to autofill credentials
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
