import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, MapPin } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { collegesApi, reviewsApi } from '../api/resources'
import { useAuth } from '../auth/AuthContext'
import { CollegeMark } from '../components/colleges'
import { PageHeader } from '../components/Layout'
import { ReviewForm } from '../components/reviews'
import { Card, EmptyState, ErrorNote, RatingRing, Spinner, Stars } from '../components/ui'
import { ApiError, errorMessage } from '../lib/api'
import { plural } from '../lib/format'

// What makes a review worth reading, shown beside the form
const PROMPTS = [
  ['Teaching', 'Are the lecturers clear, available and up to date?'],
  ['Facilities', 'Labs, library, hostel, canteen, Wi-Fi.'],
  ['Placements', 'Which companies visit, and how much help do you get?'],
  ['Campus life', 'Clubs, events, and how it feels to study there.'],
]

// Writing a review has a page of its own, reached from a college's page. Someone who has already
// reviewed the college lands on the same page with their review filled in, to change it.
export function WriteReviewPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const collegePage = `/colleges/${id}`

  const college = useQuery({
    queryKey: ['colleges', 'detail', id],
    queryFn: () => collegesApi.get(id).then((result) => result.data.college),
    // A college that does not exist will not start existing on a second try
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  })

  // Each person can review a college once, so look up whether this user already has
  const mine = useQuery({
    queryKey: ['reviews', 'mine', id, user?.userId],
    queryFn: () => reviewsApi.list({ college: id, user: user?.userId, limit: 1 }).then((result) => result.data.reviews[0] ?? null),
    enabled: college.isSuccess && Boolean(user),
  })

  const back = (
    <Link to={college.isSuccess ? collegePage : '/colleges'} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-600 hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden />
      {college.isSuccess ? `Back to ${college.data.name}` : 'All colleges'}
    </Link>
  )

  if (college.isPending) return <Spinner label="Loading college" />
  if (college.isError) {
    const notFound = college.error instanceof ApiError && (college.error.status === 404 || college.error.status === 400)
    return (
      <>
        {back}
        {notFound ? <EmptyState title="College not found">It may have been deleted, or the link is wrong.</EmptyState> : <ErrorNote>{errorMessage(college.error)}</ErrorNote>}
      </>
    )
  }

  const data = college.data
  const toCollege = () => navigate(collegePage)

  return (
    <>
      {back}
      <PageHeader
        title={mine.data ? 'Edit your review' : 'Write a review'}
        subtitle={mine.data ? 'You have already reviewed this college. Change your rating or what you wrote.' : 'One review per student per college, so every average is fair.'}
        search={false}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Card className="min-w-0 self-start">
          {mine.isPending ? (
            <Spinner />
          ) : mine.isError ? (
            <ErrorNote>{errorMessage(mine.error)}</ErrorNote>
          ) : (
            // The key makes the form start again from the saved review once that has loaded
            <ReviewForm key={mine.data?.reviewId ?? 'new'} collegeId={id} review={mine.data ?? undefined} onDone={toCollege} onCancel={toCollege} />
          )}
        </Card>

        <aside className="min-w-0 space-y-6">
          {/* Which college this is about */}
          <Card className="overflow-hidden !p-0">
            {data.image && <img src={data.image} alt="" className="h-40 w-full object-cover" />}
            <div className="flex items-center gap-4 p-5">
              {!data.image && <CollegeMark name={data.name} className="size-14 text-2xl" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg leading-tight font-medium">{data.name}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-zinc-600">
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{[data.city, data.state, data.country].filter(Boolean).join(', ')}</span>
                </p>
                <p className="mt-2 flex items-center gap-2 text-xs font-semibold">
                  {data.averageRating !== null && <Stars value={data.averageRating} />}
                  {data.reviewCount ? plural(data.reviewCount, 'review') : 'No reviews yet'}
                </p>
              </div>
              <RatingRing rating={data.averageRating} size={56} />
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-medium">What helps a future student</h2>
            <dl className="mt-3 space-y-3 text-sm">
              {PROMPTS.map(([topic, question]) => (
                <div key={topic}>
                  <dt className="font-semibold">{topic}</dt>
                  <dd className="text-zinc-600">{question}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 border-t border-zinc-200 pt-3 text-xs text-zinc-500">Write from your own experience. You can come back and edit your review at any time.</p>
          </Card>
        </aside>
      </div>
    </>
  )
}
