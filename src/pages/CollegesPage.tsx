import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collegesApi, type CollegeSort } from '../api/resources'
import { useAuth } from '../auth/AuthContext'
import { CollegeFormModal, CollegeRow } from '../components/colleges'
import { PageHeader } from '../components/Layout'
import { useToast } from '../components/Toast'
import { Button, ConfirmDialog, EmptyState, ErrorNote, Input, Pagination, Select, Spinner } from '../components/ui'
import { errorMessage } from '../lib/api'
import { plural } from '../lib/format'
import type { College } from '../lib/types'

const PAGE_SIZE = 8

const SORTS: { value: CollegeSort; label: string }[] = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'newest', label: 'Newest first' },
  { value: 'rating', label: 'Top rated' },
  { value: 'reviews', label: 'Most reviewed' },
]

export function CollegesPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()

  // Filters live in the URL, so a search can be bookmarked, shared, and survives a refresh
  const [params, setParams] = useSearchParams()
  const search = params.get('search') ?? ''
  const sort = (params.get('sort') as CollegeSort | null) ?? 'name'
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
    queryKey: ['colleges', 'list', { search, sort, minRating, page }],
    queryFn: () => collegesApi.list({ search, sort, minRating: minRating ? Number(minRating) : '', page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  const remove = useMutation({
    mutationFn: (college: College) => collegesApi.remove(college._id),
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
      <PageHeader
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

      <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_11rem]">
        <Input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search by name, city or description" aria-label="Search colleges" />
        <Select value={minRating} onChange={(event) => update({ minRating: event.target.value })} aria-label="Minimum rating">
          <option value="">Any rating</option>
          <option value="4.5">4.5 and above</option>
          <option value="4">4 and above</option>
          <option value="3">3 and above</option>
        </Select>
        <Select value={sort} onChange={(event) => update({ sort: event.target.value })} aria-label="Sort by">
          {SORTS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
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
                key={college._id}
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
