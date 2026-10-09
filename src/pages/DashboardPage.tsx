import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { collegesApi, logsApi, reviewsApi, statsApi, type CollegeSort } from '../api/resources'
import { useAuth } from '../auth/AuthContext'
import { CollegeMark, CollegeRow } from '../components/colleges'
import { BookFigure, WavingFigure } from '../components/Illustration'
import { UserBar } from '../components/Layout'
import { Avatar, Card, EmptyState, ErrorNote, RatingRing, Spinner, Stars } from '../components/ui'
import { errorMessage } from '../lib/api'
import { cn, formatDate, plural, weekdayOf } from '../lib/format'
import type { College, StatsOverview } from '../lib/types'

const TABS: { label: string; sort: CollegeSort }[] = [
  { label: 'All colleges', sort: 'name' },
  { label: 'The newest', sort: 'newest' },
  { label: 'Top rated', sort: 'rating' },
  { label: 'Most reviewed', sort: 'reviews' },
]

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn('cursor-pointer rounded-lg px-1 py-1 font-display text-sm font-medium whitespace-nowrap transition-colors', active ? 'text-ink' : 'text-zinc-400 hover:text-zinc-600')}
    >
      {children}
    </button>
  )
}

// The best-rated colleges, one at a time, with arrows to step through them
function Featured({ colleges }: { colleges: College[] }) {
  const [index, setIndex] = useState(0)
  if (!colleges.length) return null
  const college = colleges[index % colleges.length]
  const step = (by: number) => setIndex((current) => (current + by + colleges.length) % colleges.length)

  return (
    <section className="flex items-center gap-3" aria-label="Top rated colleges">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-3 rounded-3xl bg-panel p-3 pr-4">
        <CollegeMark name={college.name} />
        <div className="min-w-0 flex-1 basis-32">
          <p className="truncate font-display text-base leading-tight font-medium">{college.name}</p>
          <p className="truncate text-xs text-zinc-500">
            {college.city} · {plural(college.reviewCount, 'review')}
          </p>
        </div>
        <RatingRing rating={college.averageRating} size={48} />
        <Link to={`/colleges/${college._id}`} className="inline-flex h-10 items-center rounded-xl bg-ink px-6 text-xs font-semibold text-white transition-colors hover:bg-zinc-800">
          View
        </Link>
      </div>
      {colleges.length > 1 && (
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => step(-1)} className="grid size-10 cursor-pointer place-items-center rounded-full border-2 border-ink transition-colors hover:bg-ink hover:text-white" aria-label="Previous top college">
            <ArrowLeft className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={() => step(1)} className="grid size-10 cursor-pointer place-items-center rounded-full border-2 border-ink transition-colors hover:bg-ink hover:text-white" aria-label="Next top college">
            <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </section>
  )
}

function StatTile({ value, label }: { value: number | string; label: string }) {
  return (
    <Card className="flex items-center gap-3">
      <span className="font-display text-5xl leading-none font-medium">{value}</span>
      <span className="text-sm leading-tight font-medium text-zinc-700">{label}</span>
    </Card>
  )
}

const AXIS = { fontSize: 11, fill: '#71717a', fontWeight: 500 }

function Activity({ stats }: { stats: StatsOverview }) {
  const [view, setView] = useState<'days' | 'ratings'>('days')
  const days = stats.reviewsPerDay.map((day) => ({ label: weekdayOf(day.date), count: day.count }))
  const ratings = stats.ratingDistribution.map((row) => ({ label: `${row.rating}★`, count: row.count }))
  const weekTotal = days.reduce((sum, day) => sum + day.count, 0)

  return (
    <section aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="text-2xl font-medium">
        Review activity
      </h2>
      <div className="mt-2 flex gap-5" role="tablist" aria-label="Chart">
        <TabButton active={view === 'days'} onClick={() => setView('days')}>
          Last 7 days
        </TabButton>
        <TabButton active={view === 'ratings'} onClick={() => setView('ratings')}>
          By rating
        </TabButton>
      </div>

      {/* The same figures as text, for screen readers and anyone who prefers numbers */}
      <p className="sr-only">
        {view === 'days'
          ? `${plural(weekTotal, 'review')} in the last 7 days: ${days.map((day) => `${day.label} ${day.count}`).join(', ')}.`
          : `Reviews by rating: ${ratings.map((row) => `${row.label} ${row.count}`).join(', ')}.`}
      </p>

      <div className="mt-3 h-56" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          {view === 'days' ? (
            <LineChart data={days} margin={{ top: 24, right: 16, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e4e4e7" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} dy={6} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS} />
              <Line type="monotone" dataKey="count" stroke="#0c0c0d" strokeWidth={2.5} dot={{ r: 4, fill: '#0c0c0d', strokeWidth: 0 }} isAnimationActive={false}>
                <LabelList dataKey="count" position="top" offset={10} style={{ fontSize: 11, fontWeight: 600, fill: '#0c0c0d' }} />
              </Line>
            </LineChart>
          ) : (
            <BarChart data={ratings} margin={{ top: 24, right: 16, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e4e4e7" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} dy={6} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS} />
              <Bar dataKey="count" fill="#0c0c0d" radius={[8, 8, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 600, fill: '#0c0c0d' }} />
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  )
}

// A different nudge depending on what the user's role lets them do
function NextStep() {
  const { can } = useAuth()
  const isAuditor = can('log:read')

  const denied = useQuery({
    queryKey: ['logs', 'denied-count'],
    queryFn: () => logsApi.list({ outcome: 'denied', limit: 1 }),
    enabled: isAuditor,
  })

  let content: { title: string; text: string; to: string; action: string }
  if (isAuditor) {
    const count = denied.data?.meta?.total
    content = {
      title: 'Keep an eye on things',
      text: count === undefined ? 'Every change and every refused attempt is recorded.' : `${plural(count, 'refused attempt')} recorded in the action log.`,
      to: '/logs',
      action: 'Open action log',
    }
  } else if (can('college:create')) {
    content = { title: 'Know a college we missed?', text: 'Add it so students can start reviewing it.', to: '/colleges?new=1', action: 'Add a college' }
  } else if (can('review:create')) {
    content = { title: 'Share what you know!', text: 'Your review helps the next student choose well.', to: '/colleges', action: 'Review a college' }
  } else {
    content = { title: 'Explore colleges', text: 'See how students rate colleges across the country.', to: '/colleges', action: 'Browse colleges' }
  }

  return (
    <Card className="flex items-center justify-between gap-4">
      <div>
        <h2 className="text-xl leading-tight font-medium">{content.title}</h2>
        <p className="mt-1 max-w-52 text-sm text-zinc-600">{content.text}</p>
        <Link to={content.to} className="mt-4 inline-flex h-10 items-center rounded-xl bg-ink px-5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800">
          {content.action}
        </Link>
      </div>
      <BookFigure className="hidden h-28 shrink-0 sm:block" />
    </Card>
  )
}

// The newest reviews across every college, so the dashboard shows what people are saying right now
function LatestReviews() {
  const latest = useQuery({ queryKey: ['reviews', 'latest'], queryFn: () => reviewsApi.list({ sort: 'newest', limit: 3 }).then((result) => result.data.reviews) })
  if (!latest.data?.length) return null

  return (
    <section aria-labelledby="latest-heading">
      <h2 id="latest-heading" className="text-2xl font-medium">
        Latest reviews
      </h2>
      <ul className="mt-3 space-y-2.5">
        {latest.data.map((review) => (
          <li key={review._id} className="flex gap-3 rounded-3xl bg-panel p-4">
            <Avatar name={review.user?.username ?? '?'} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                <span className="font-medium">{review.user?.username ?? 'Deleted user'}</span>
                <span className="text-zinc-500"> on </span>
                {review.college ? (
                  <Link to={`/colleges/${review.college._id}`} className="font-medium underline-offset-4 hover:underline">
                    {review.college.name}
                  </Link>
                ) : (
                  'a deleted college'
                )}
              </p>
              <div className="mt-1 flex items-center gap-2.5">
                <Stars value={review.rating} />
                <span className="text-xs text-zinc-500">{formatDate(review.createdAt)}</span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm text-zinc-600">{review.comment}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function DashboardPage() {
  const { user, can } = useAuth()
  const [tab, setTab] = useState<CollegeSort>('name')

  const stats = useQuery({ queryKey: ['stats'], queryFn: () => statsApi.overview().then((result) => result.data) })
  const top = useQuery({ queryKey: ['colleges', 'top'], queryFn: () => collegesApi.list({ sort: 'rating', limit: 5 }).then((result) => result.data.colleges) })
  const list = useQuery({ queryKey: ['colleges', 'dashboard', tab], queryFn: () => collegesApi.list({ sort: tab, limit: 5 }) })

  // Only colleges that have a rating belong in "top rated"
  const featured = top.data?.filter((college) => college.averageRating !== null) ?? []

  return (
    <div className="grid gap-x-10 gap-y-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      {/* Left column: greeting, top colleges, the list */}
      <div className="min-w-0 space-y-6">
        <div className="xl:hidden">
          <UserBar />
        </div>

        <section className="relative flex min-h-36 items-center overflow-hidden rounded-3xl bg-panel px-7 py-6">
          <div className="relative z-10">
            <h1 className="text-4xl leading-none font-medium">Hello {user?.username}!</h1>
            <p className="mt-2 text-sm text-zinc-600">It's good to see you again.</p>
          </div>
          <WavingFigure className="absolute right-6 -bottom-1 hidden h-40 sm:block" />
        </section>

        <Featured colleges={featured} />

        <section aria-labelledby="colleges-heading">
          <h2 id="colleges-heading" className="text-2xl font-medium">
            Colleges
          </h2>
          <div className="mt-2 flex gap-5 overflow-x-auto" role="tablist" aria-label="Order colleges by">
            {TABS.map(({ label, sort }) => (
              <TabButton key={sort} active={tab === sort} onClick={() => setTab(sort)}>
                {label}
              </TabButton>
            ))}
          </div>

          <div className="mt-3">
            {list.isPending ? (
              <Spinner label="Loading colleges" />
            ) : list.isError ? (
              <ErrorNote>{errorMessage(list.error)}</ErrorNote>
            ) : list.data.data.colleges.length === 0 ? (
              <EmptyState title="No colleges yet">{can('college:create') ? 'Add the first one from the Colleges page.' : 'Check back soon.'}</EmptyState>
            ) : (
              <>
                <ul className="space-y-2.5">
                  {list.data.data.colleges.map((college) => (
                    <CollegeRow key={college._id} college={college} />
                  ))}
                </ul>
                {(list.data.meta?.total ?? 0) > 5 && (
                  <Link to="/colleges" className="mt-4 inline-block text-sm font-semibold underline underline-offset-4">
                    See all {list.data.meta?.total} colleges
                  </Link>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {/* Right column: search and user, totals, the chart, the next step */}
      <div className="min-w-0 space-y-6">
        <div className="hidden xl:block">
          <UserBar />
        </div>

        {stats.isPending ? (
          <Spinner label="Loading figures" />
        ) : stats.isError ? (
          <ErrorNote>{errorMessage(stats.error)}</ErrorNote>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <StatTile value={stats.data.totals.colleges} label={stats.data.totals.colleges === 1 ? 'College listed' : 'Colleges listed'} />
              {/* Reviewers see their own count; people who run the system (they can read the log) see the total */}
              {can('review:create') && !can('log:read') ? (
                <StatTile value={stats.data.totals.myReviews} label={stats.data.totals.myReviews === 1 ? 'Review by you' : 'Reviews by you'} />
              ) : (
                <StatTile value={stats.data.totals.reviews} label={stats.data.totals.reviews === 1 ? 'Review in total' : 'Reviews in total'} />
              )}
            </div>
            <Activity stats={stats.data} />
          </>
        )}

        <NextStep />
        <LatestReviews />
      </div>
    </div>
  )
}
