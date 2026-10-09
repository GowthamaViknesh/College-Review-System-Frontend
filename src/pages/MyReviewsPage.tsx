import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { reviewsApi } from '../api/resources'
import { useAuth } from '../auth/AuthContext'
import { PageHeader } from '../components/Layout'
import { ReviewCard } from '../components/reviews'
import { EmptyState, ErrorNote, Pagination, Spinner } from '../components/ui'
import { errorMessage } from '../lib/api'
import { plural } from '../lib/format'

const PAGE_SIZE = 6

export function MyReviewsPage() {
  const { user } = useAuth()
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['reviews', 'by-user', user?._id, page],
    queryFn: () => reviewsApi.list({ user: user?._id, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled: Boolean(user),
  })

  const reviews = query.data?.data.reviews ?? []
  const total = query.data?.meta?.total

  return (
    <>
      <PageHeader title="My reviews" subtitle={total === undefined ? undefined : `You have written ${plural(total, 'review')}`} />

      {query.isPending ? (
        <Spinner label="Loading your reviews" />
      ) : query.isError ? (
        <ErrorNote>{errorMessage(query.error)}</ErrorNote>
      ) : reviews.length === 0 ? (
        <EmptyState title="You have not reviewed a college yet">
          <Link to="/colleges" className="font-semibold text-ink underline underline-offset-4">
            Find a college to review
          </Link>
        </EmptyState>
      ) : (
        <>
          <ul className={`grid gap-3 lg:grid-cols-2 ${query.isPlaceholderData ? 'opacity-60' : ''}`}>
            {reviews.map((review) => (
              <ReviewCard key={review._id} review={review} showCollege />
            ))}
          </ul>
          <Pagination meta={query.data?.meta} onPage={setPage} />
        </>
      )}
    </>
  )
}
