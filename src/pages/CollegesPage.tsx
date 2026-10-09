import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownAZ, ArrowDownWideNarrow, ArrowUpNarrowWide, ArrowUpZA, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collegesApi, type CollegeSort, type SortOrder } from '../api/resources'
import { useAuth } from '../auth/AuthContext'
import { CollegeFormModal, CollegeRow } from '../components/colleges'
import { PageHeader } from '../components/Layout'
import { useToast } from '../components/Toast'
import { Button, ConfirmDialog, EmptyState, ErrorNote, Input, Pagination, Select, Spinner } from '../components/ui'
import { errorMessage } from '../lib/api'
import { plural } from '../lib/format'
import type { College } from '../lib/types'

const PAGE_SIZE = 8

// What the list can be ordered by. Each has a natural direction (names A to Z, the rest highest or newest first)
// and words for both directions, used by the button that flips it.
const SORTS: { value: CollegeSort; label: string; natural: SortOrder; asc: string; desc: string }[] = [
  { value: 'name', label: 'Name', natural: 'asc', asc: 'A to Z', desc: 'Z to A' },
  { value: 'newest', label: 'Date added', natural: 'desc', asc: 'oldest first', desc: 'newest first' },
  { value: 'rating', label: 'Rating', natural: 'desc', asc: 'lowest first', desc: 'highest first' },
  { value: 'reviews', label: 'Number of reviews', natural: 'desc', asc: 'fewest first', desc: 'most first' },
]

export function CollegesPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()

  // Filters live in the URL, so a search can be bookmarked, shared, and survives a refresh
  const [params, setParams] = useSearchParams()
  const search = params.get('search') ?? ''
  const sort = (params.get('sort') as CollegeSort | null) ?? 'name'
  const sortInfo = SORTS.find((item) => item.value === sort) ?? SORTS[0]
  // No direction in the URL means the sort's natural one
  const order: SortOrder = params.get('order') === 'asc' || params.get('order') === 'desc' ? (params.get('order') as SortOrder) : sortInfo.natural
  const flipped: SortOrder = order === 'asc' ? 'desc' : 'asc'
  const OrderIcon = sort === 'name' ? (order === 'asc' ? ArrowDownAZ : ArrowUpZA) : order === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow
  const minRating = params.get('minRating') ?? ''
  const page = Number(params.get('page')) || 1

  const [searchText, setSearchText] = useState(search)
  const [editing, setEditing] = useState<College | 'new' | null>(params.get('new') === '1' && can('college:create') ? 'new' : null)
  const [deleting, setDeleting] = useState<College | null>(null)

  // Keep the box in step when the search arrives from elsewhere (the search bar in the header)
  useEffect(() => setSearchText(search), [search])

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params)
    next.delete('new')
    // Any change to the filters starts again from the first page
    if (!('page' in changes)) next.delete('page')
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }

  // Search as you type, after a short pause
  useEffect(() => {
    if (searchText.trim() === search) return
    const timer = setTimeout(() => update({ search: searchText.trim() }), 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text should restart the timer
  }, [searchText])

  const query = useQuery({
    queryKey: ['colleges', 'list', { search, sort, order, minRating, page }],
    queryFn: () => collegesApi.list({ search, sort, order, minRating: minRating ? Number(minRating) : '', page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  const remove = useMutation({
    mutationFn: (college: College) => collegesApi.remove(college.collegeId),
    onSuccess: (_result, college) => {
      queryClient.invalidateQueries({ queryKey: ['colleges'] })
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success(`${college.name} deleted`)
      setDeleting(null)
    },
  })

  const colleges = query.data?.data.colleges ?? []
  const total = query.data?.meta?.total
  const filtered = Boolean(search || minRating)

  return (
    <>
      {/* This page has its own search box below, so the one in the header is left out */}
      <PageHeader
        search={false}
        title="Colleges"
        subtitle={total === undefined ? 'Ratings are the average of student reviews' : `${plural(total, 'college')}${filtered ? ' match your filters' : ''}`}
        actions={
          can('college:create') && (
            <Button onClick={() => setEditing('new')}>
              <Plus className="size-4" aria-hidden />
              Add college
            </Button>
          )
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_13rem]">
        <Input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search by name, city or description" aria-label="Search colleges" />
        <Select value={minRating} onChange={(event) => update({ minRating: event.target.value })} aria-label="Minimum rating">
          <option value="">Any rating</option>
          <option value="4.5">4.5 and above</option>
          <option value="4">4 and above</option>
          <option value="3">3 and above</option>
        </Select>
        <div className="flex gap-2">
          {/* Choosing a different field goes back to that field's natural direction */}
          <Select value={sort} onChange={(event) => update({ sort: event.target.value, order: '' })} aria-label="Sort by" className="min-w-0 flex-1">
            {SORTS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            className="!size-11 !rounded-xl !px-0"
            onClick={() => update({ order: flipped === sortInfo.natural ? '' : flipped })}
            aria-label={`Sorted ${sortInfo[order]}. Switch to ${sortInfo[flipped]}.`}
            title={`Sorted ${sortInfo[order]}. Click for ${sortInfo[flipped]}.`}
          >
            <OrderIcon className="size-5" aria-hidden />
          </Button>
        </div>
      </div>

      {query.isPending ? (
        <Spinner label="Loading colleges" />
      ) : query.isError ? (
        <ErrorNote>{errorMessage(query.error)}</ErrorNote>
      ) : colleges.length === 0 ? (
        <EmptyState title={filtered ? 'No colleges match' : 'No colleges yet'}>
          {filtered ? (
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => setParams({}, { replace: true })}>
              <X className="size-3.5" aria-hidden />
              Clear filters
            </Button>
          ) : can('college:create') ? (
            'Add the first college to get started.'
          ) : (
            'Check back soon.'
          )}
        </EmptyState>
      ) : (
        <>
          <ul className={`space-y-2.5 transition-opacity ${query.isPlaceholderData ? 'opacity-60' : ''}`}>
            {colleges.map((college) => (
              <CollegeRow
                key={college.collegeId}
                college={college}
                actions={
                  <>
                    {can('college:update') && (
                      <Button variant="ghost" size="icon" onClick={() => setEditing(college)} aria-label={`Edit ${college.name}`}>
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                    )}
                    {can('college:delete') && (
                      <Button variant="ghost" size="icon" onClick={() => setDeleting(college)} aria-label={`Delete ${college.name}`}>
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    )}
                  </>
                }
              />
            ))}
          </ul>
          <Pagination meta={query.data?.meta} onPage={(next) => update({ page: String(next) })} />
        </>
      )}

      {editing && <CollegeFormModal college={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete college"
          loading={remove.isPending}
          error={remove.error ? errorMessage(remove.error) : null}
          onConfirm={() => remove.mutate(deleting)}
          onClose={() => {
            remove.reset()
            setDeleting(null)
          }}
        >
          This also deletes its {plural(deleting.reviewCount, 'review')}. It cannot be undone.
        </ConfirmDialog>
      )}
    </>
  )
}
