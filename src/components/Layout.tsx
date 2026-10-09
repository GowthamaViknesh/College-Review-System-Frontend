import { ChevronsUpDown, GraduationCap, House, LogOut, MessageSquareText, PanelLeftClose, PanelLeftOpen, ScrollText, Search, ShieldCheck, UserRound, Users, type LucideIcon } from 'lucide-react'
import { Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { cn, displayName } from '../lib/format'
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

const SIDEBAR_KEY = 'college-reviews.sidebar-collapsed'

// Whether the sidebar shows icons only. Remembered between visits; on a first visit it starts
// collapsed on narrower screens, where the room is better spent on the page.
function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_KEY)
    return saved === null ? window.innerWidth < 1280 : saved === 'true'
  })

  function toggle() {
    setCollapsed((current) => {
      localStorage.setItem(SIDEBAR_KEY, String(!current))
      return !current
    })
  }
  return [collapsed, toggle] as const
}

// The look of one row in the sidebar: a square when collapsed, a full-width row with a name when expanded
const rowClass = (collapsed: boolean, active = false) =>
  cn(
    'group relative flex h-12 shrink-0 cursor-pointer items-center gap-3 rounded-xl text-sm font-medium transition-colors',
    collapsed ? 'w-12 justify-center' : 'w-full px-4',
    active ? 'bg-white/15 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white',
  )

// The name of a row, shown beside its icon on hover or keyboard focus while the sidebar is collapsed
function Tip({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-full z-30 ml-3 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white opacity-0 shadow-soft ring-1 ring-white/10 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
      {children}
    </span>
  )
}

// The signed-in user. Clicking it opens a small menu with their profile and the way out.
// `placement` says where the menu opens relative to the button, so it never leaves the screen.
function UserMenu({ compact, placement }: { compact: boolean; placement: 'above' | 'beside' | 'above-end' }) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const location = useLocation()

  // Close after moving to another page, on a click anywhere else, and on Escape
  useEffect(() => setOpen(false), [location.pathname])
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => !container.current?.contains(event.target as Node) && setOpen(false)
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null
  const menuPosition = { above: 'bottom-full left-0 mb-2 w-full min-w-52', beside: 'bottom-0 left-full ml-6 w-52', 'above-end': 'right-0 bottom-full mb-3 w-52' }[placement]
  const itemClass = 'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink hover:bg-panel'

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${displayName(user.username)}`}
        className={cn(
          'flex cursor-pointer items-center gap-3 rounded-2xl text-left transition-colors',
          compact ? 'size-12 justify-center' : 'w-full p-2 hover:bg-white/10',
          open && !compact && 'bg-white/10',
        )}
      >
        <Avatar name={user.username} className="!bg-white !text-ink" />
        {!compact && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium text-white">{displayName(user.username)}</span>
              <span className="block truncate text-xs text-zinc-400 capitalize">{user.role?.name ?? 'no role'}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-zinc-500" aria-hidden />
          </>
        )}
      </button>

      {open && (
        <div role="menu" aria-label="Account" className={cn('absolute z-40 rounded-2xl bg-white p-1.5 shadow-float ring-1 ring-zinc-200', menuPosition)}>
          {/* When only the avatar is showing, the menu says who is signed in */}
          {compact && (
            <div className="border-b border-zinc-100 px-3 pt-2 pb-2.5 leading-tight">
              <p className="truncate text-sm font-medium text-ink">{displayName(user.username)}</p>
              <p className="truncate text-xs text-zinc-500 capitalize">{user.role?.name ?? 'no role'}</p>
            </div>
          )}
          <Link to="/profile" role="menuitem" className={itemClass}>
            <UserRound className="size-4" aria-hidden />
            Profile
          </Link>
          <button type="button" role="menuitem" onClick={logout} className={itemClass}>
            <LogOut className="size-4" aria-hidden />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

function Sidebar() {
  const { can } = useAuth()
  const [collapsed, toggleCollapsed] = useSidebarCollapsed()
  const items = NAV.filter((item) => !item.anyOf || item.anyOf.some(can))
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <>
      {/* Desktop: a full-height column on the left edge that can be collapsed to icons */}
      <aside className={cn('sticky top-0 hidden h-screen shrink-0 flex-col bg-ink py-6 transition-[width] duration-200 lg:flex', collapsed ? 'w-20 items-center px-4' : 'w-68 px-4')}>
        <div className={cn('flex items-center', collapsed ? 'flex-col gap-4' : 'justify-between gap-2 pl-1')}>
          <NavLink to="/" className="flex min-w-0 items-center gap-3 text-base font-medium whitespace-nowrap text-white" aria-label="College Reviews home">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-xl font-semibold text-ink">C.</span>
            {!collapsed && <span>College Reviews</span>}
          </NavLink>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className="group relative grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ToggleIcon className="size-5" aria-hidden />
            {collapsed && <Tip>Expand sidebar</Tip>}
          </button>
        </div>

        <nav className={cn('mt-8 flex flex-1 flex-col gap-1.5', collapsed && 'items-center')} aria-label="Main">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => rowClass(collapsed, isActive)} aria-label={label}>
              <Icon className="size-5 shrink-0" aria-hidden />
              {collapsed ? <Tip>{label}</Tip> : <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={cn('border-t border-white/10 pt-4', collapsed && 'flex justify-center')}>
          <UserMenu compact={collapsed} placement={collapsed ? 'beside' : 'above'} />
        </div>
      </aside>

      {/* Phones and tablets: the same destinations in a bar along the bottom, with the account menu at the end */}
      <nav className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-3xl bg-ink px-2 py-2 shadow-float lg:hidden" aria-label="Main">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => rowClass(true, isActive)} aria-label={label}>
            <Icon className="size-5" aria-hidden />
          </NavLink>
        ))}
        <UserMenu compact placement="above-end" />
      </nav>
    </>
  )
}

// The search box at the top right of every page. Searching always lands on the Colleges page.
export function SearchBar({ className }: { className?: string }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    navigate(`/colleges${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`)
    setSearch('')
  }

  return (
    <form onSubmit={submit} role="search" className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-zinc-500" aria-hidden />
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search colleges"
        aria-label="Search colleges"
        className="h-11 w-full min-w-44 rounded-2xl bg-panel pr-4 pl-11 text-sm placeholder:text-zinc-400 focus:ring-2 focus:ring-ink focus:outline-none"
      />
    </form>
  )
}

export function PageHeader({ title, subtitle, actions, search = true }: { title: string; subtitle?: string; actions?: ReactNode; search?: boolean }) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl leading-tight font-medium">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
        {actions}
        {search && <SearchBar className="hidden w-64 sm:block" />}
      </div>
    </header>
  )
}

// Everything behind login: the sidebar down the left edge and the page filling the rest of the window
export function AppLayout() {
  const { user, loading, loggedOutByChoice } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner label="Signing you in" />
  // Remember the page so login can return to it, unless the user logged out on purpose:
  // whoever logs in next (possibly someone else) should start at the dashboard
  if (!user) return <Navigate to="/login" replace state={loggedOutByChoice ? null : { from: location.pathname }} />

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
