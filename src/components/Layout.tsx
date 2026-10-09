import { GraduationCap, House, LogOut, MessageSquareText, ScrollText, Search, ShieldCheck, Users, type LucideIcon } from 'lucide-react'
import { Suspense, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { cn } from '../lib/format'
import { Avatar, EmptyState, Spinner } from './ui'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  // Shown only if the user has at least one of these permissions; shown to everyone when omitted
  anyOf?: string[]
}

const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: House },
  { to: '/colleges', label: 'Colleges', icon: GraduationCap },
  { to: '/my-reviews', label: 'My reviews', icon: MessageSquareText, anyOf: ['review:create'] },
  { to: '/users', label: 'Users', icon: Users, anyOf: ['user:read', 'user:create'] },
  { to: '/roles', label: 'Roles', icon: ShieldCheck, anyOf: ['role:read'] },
  { to: '/logs', label: 'Action logs', icon: ScrollText, anyOf: ['log:read'] },
]

// One destination in the sidebar: just the icon on narrower screens, icon and name on wide ones
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'group relative flex h-12 w-12 shrink-0 items-center justify-center gap-3 rounded-xl text-sm font-medium transition-colors xl:w-full xl:justify-start xl:px-4',
    isActive ? 'bg-white/15 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white',
  )

// The name of a destination, shown beside its icon on hover or keyboard focus while the sidebar is icon-only
function Tip({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-full z-20 ml-3 hidden rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white opacity-0 shadow-soft transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 lg:block xl:hidden">
      {children}
    </span>
  )
}

function Sidebar() {
  const { can, logout } = useAuth()
  const items = NAV.filter((item) => !item.anyOf || item.anyOf.some(can))

  return (
    <>
      {/* Desktop: a full-height column on the left edge. Icons only at first; names appear beside them on wide screens. */}
      <aside className="sticky top-0 hidden h-screen w-20 shrink-0 flex-col items-center bg-ink px-4 py-8 lg:flex xl:w-64 xl:items-stretch xl:px-5">
        <NavLink to="/" className="flex items-center gap-3 text-lg font-medium text-white xl:px-1" aria-label="College Reviews home">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-xl font-semibold text-ink">C.</span>
          <span className="hidden xl:inline">College Reviews</span>
        </NavLink>

        <nav className="mt-12 flex flex-1 flex-col items-center gap-1.5 xl:items-stretch" aria-label="Main">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={navLinkClass} aria-label={label}>
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className="hidden xl:inline">{label}</span>
              <Tip>{label}</Tip>
            </NavLink>
          ))}
        </nav>

        <button type="button" onClick={logout} className={cn(navLinkClass({ isActive: false }), 'cursor-pointer')} aria-label="Log out">
          <LogOut className="size-5 shrink-0" aria-hidden />
          <span className="hidden xl:inline">Log out</span>
          <Tip>Log out</Tip>
        </button>
      </aside>

      {/* Phones and tablets: the same destinations in a bar along the bottom */}
      <nav className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-3xl bg-ink px-2 py-2 shadow-float lg:hidden" aria-label="Main">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={navLinkClass} aria-label={label}>
            <Icon className="size-5" aria-hidden />
          </NavLink>
        ))}
        <button type="button" onClick={logout} className={cn(navLinkClass({ isActive: false }), 'cursor-pointer')} aria-label="Log out">
          <LogOut className="size-5" aria-hidden />
        </button>
      </nav>
    </>
  )
}

// The search box and the signed-in user, shown at the top right of every page
export function UserBar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    navigate(`/colleges${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`)
    setSearch('')
  }

  if (!user) return null
  return (
    <div className="flex items-center gap-3">
      <form onSubmit={submit} role="search" className="relative hidden flex-1 sm:block">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-zinc-500" aria-hidden />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search colleges"
          aria-label="Search colleges"
          className="h-11 w-full min-w-44 rounded-2xl bg-panel pr-4 pl-11 text-sm placeholder:text-zinc-400 focus:ring-2 focus:ring-ink focus:outline-none"
        />
      </form>
      <div className="flex items-center gap-2.5">
        <div className="hidden text-right leading-tight sm:block">
          <p className="text-sm font-semibold">{user.username}</p>
          <p className="text-xs text-zinc-500 capitalize">{user.role?.name ?? 'no role'}</p>
        </div>
        <Avatar name={user.username} />
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl leading-tight font-medium">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
        {actions}
        <UserBar />
      </div>
    </header>
  )
}

// Everything behind login: the sidebar down the left edge and the page filling the rest of the window
export function AppLayout() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner label="Signing you in" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      {/* Extra space at the bottom on small screens keeps content clear of the navigation bar */}
      <main className="min-w-0 flex-1 px-4 pt-6 pb-28 sm:px-8 lg:px-10 lg:py-8 2xl:px-14">
        {/* Pages are loaded on demand; the sidebar stays put while one arrives */}
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}

// Wraps a page that needs a permission. The API would refuse the data anyway; this explains why instead of showing errors.
export function RequirePermission({ anyOf, children }: { anyOf: string[]; children: ReactNode }) {
  const { can } = useAuth()
  if (anyOf.some(can)) return children
  return (
    <EmptyState title="You don't have access to this page">
      Your role does not include the permission it needs ({anyOf.join(' or ')}). Ask an administrator if you think it should.
    </EmptyState>
  )
}
