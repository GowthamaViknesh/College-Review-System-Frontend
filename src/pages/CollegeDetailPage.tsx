import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, MapPin, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { collegesApi, reviewsApi, type ReviewSort } from '../api/resources'
import { useAuth } from '../auth/AuthContext'
import { CollegeFormModal, CollegeMark } from '../components/colleges'
import { PageHeader } from '../components/Layout'
import { ReviewCard, ReviewForm } from '../components/reviews'
import { useToast } from '../components/Toast'
import { Button, Card, ConfirmDialog, EmptyState, ErrorNote, Pagination, RatingRing, Select, Spinner, Stars } from '../components/ui'
import { ApiError, errorMessage } from '../lib/api'
import { plural } from '../lib/format'

const PAGE_SIZE = 5

const SORTS: { value: ReviewSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'highest', label: 'Highest rated' },
  { value: 'lowest', label: 'Lowest rated' },
]

export function CollegeDetailPage() {
  const { id = '' } = useParams()
  const { user, can } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [sort, setSort] = useState<ReviewSort>('newest')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const college = useQuery({
    queryKey: ['colleges', 'detail', id],
    queryFn: () => collegesApi.get(id).then((result) => result.data.college),
    // A college that does not exist will not start existing on a second try
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  })

  const reviews = useQuery({
    queryKey: ['reviews', 'college', id, { sort, page }],
    queryFn: () => reviewsApi.list({ college: id, sort, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled: college.isSuccess,
  })

  // Each person can review a college once, so look up whether this user already has
  const canReview = can('review:create')
  const mine = useQuery({
    queryKey: ['reviews', 'mine', id, user?.userId],
    queryFn: () => reviewsApi.list({ college: id, user: user?.userId, limit: 1 }).then((result) => result.data.reviews[0] ?? null),
    enabled: college.isSuccess && canReview && Boolean(user),
  })

  const remove = useMutation({
    mutationFn: () => collegesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colleges'] })
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('College deleted')
      navigate('/colleges', { replace: true })
    },
  })

  const back = (
    <Link to="/colleges" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-600 hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden />
      All colleges
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
  const reviewList = reviews.data?.data.reviews ?? []

  return (
    <>
      {back}
      <PageHeader
        title={data.name}
        actions={
          <>
            {can('college:update') && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil className="size-4" aria-hidden />
                Edit
              </Button>
            )}
            {can('college:delete') && (
              <Button variant="secondary" onClick={() => setDeleting(true)}>
                <Trash2 className="size-4" aria-hidden />
                Delete
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          {data.image && <img src={data.image} alt={`${data.name}`} className="h-56 w-full rounded-3xl bg-panel object-cover sm:h-72" />}
          <Card className="flex flex-wrap items-center gap-5">
            {!data.image && <CollegeMark name={data.name} className="size-16 text-3xl" />}
            <div className="min-w-0 flex-1 basis-48">
              <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-600">
                <MapPin className="size-4" aria-hidden />
                {/* Street address first when there is one, then city, state and country */}
                {[data.address, data.city, data.state, data.country].filter(Boolean).join(', ')}
              </p>
              {data.description && <p className="mt-2 text-sm leading-relaxed text-zinc-700">{data.description}</p>}
            </div>
            <div className="flex items-center gap-3">
              <RatingRing rating={data.averageRating} size={72} />
              <div>
                {data.averageRating !== null && <Stars value={data.averageRating} />}
                <p className="text-sm font-semibold">{data.reviewCount ? plural(data.reviewCount, 'review') : 'No reviews yet'}</p>
              </div>
            </div>
          </Card>

          <section aria-labelledby="reviews-heading">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="reviews-heading" className="text-2xl font-medium">
                Reviews
              </h2>
              {data.reviewCount > 1 && (
                <Select
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value as ReviewSort)
                    setPage(1)
                  }}
                  aria-label="Sort reviews"
                  className="!w-44"
                >
                  {SORTS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            {reviews.isPending ? (
              <Spinner label="Loading reviews" />
            ) : reviews.isError ? (
              <ErrorNote>{errorMessage(reviews.error)}</ErrorNote>
            ) : reviewList.length === 0 ? (
              <EmptyState title="No reviews yet">{canReview ? 'Be the first to review this college.' : 'Students have not reviewed this college yet.'}</EmptyState>
            ) : (
              <>
                <ul className={`space-y-3 transition-opacity ${reviews.isPlaceholderData ? 'opacity-60' : ''}`}>
                  {reviewList.map((review) => (
                    <ReviewCard key={review.reviewId} review={review} />
                  ))}
                </ul>
                <Pagination meta={reviews.data?.meta} onPage={setPage} />
              </>
            )}
          </section>
        </div>

        {/* Right column: write a review, or see why you cannot */}
        <aside className="min-w-0">
          <Card className="xl:sticky xl:top-6">
            {!canReview ? (
              <>
                <h2 className="text-xl font-medium">Reviews come from students</h2>
                <p className="mt-1 text-sm text-zinc-600">Your role ({user?.role?.name ?? 'none'}) can read reviews but not write them, so that ratings reflect student experience.</p>
              </>
            ) : mine.isPending ? (
              <Spinner />
            ) : mine.data ? (
              <>
                <h2 className="text-xl font-medium">You reviewed this college</h2>
                <p className="mt-1 mb-3 text-sm text-zinc-600">One review per student keeps the average fair. You can edit or delete yours.</p>
                <ul>
                  <ReviewCard review={mine.data} />
                </ul>
              </>
            ) : (
              <>
                <h2 className="mb-3 text-xl font-medium">Write a review</h2>
                <ReviewForm collegeId={id} />
              </>
            )}
          </Card>
        </aside>
      </div>

      {editing && <CollegeFormModal college={data} onClose={() => setEditing(false)} />}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${data.name}?`}
          confirmLabel="Delete college"
          loading={remove.isPending}
          error={remove.error ? errorMessage(remove.error) : null}
          onConfirm={() => remove.mutate()}
          onClose={() => setDeleting(false)}
        >
          This also deletes its {plural(data.reviewCount, 'review')}. It cannot be undone.
        </ConfirmDialog>
      )}
    </>
  )
}
