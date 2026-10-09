import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPin, MessageSquareText, Star } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { collegesApi } from '../api/resources'
import { formatRating, plural } from '../lib/format'
import { applyServerErrors } from '../lib/forms'
import type { College } from '../lib/types'
import { useToast } from './Toast'
import { Button, ErrorNote, Field, Input, Modal, Textarea } from './ui'

// The square tile with the college's initial, standing in for a logo
export function CollegeMark({ name, className = 'size-12 text-xl' }: { name: string; className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-2xl bg-white font-display font-medium shadow-sm ${className}`} aria-hidden>
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

// One line of a college list: name and place on the left, rating and review count, then the actions
export function CollegeRow({ college, actions }: { college: College; actions?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-3xl bg-panel p-3 pr-4 transition-shadow hover:shadow-soft">
      <CollegeMark name={college.name} />
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate font-display text-base leading-tight font-medium">{college.name}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-500">
          <MapPin className="size-3 shrink-0" aria-hidden />
          {college.city}, {college.state}
        </p>
      </div>
      <div className="flex items-center gap-4 text-xs font-semibold">
        <span className="flex w-12 items-center gap-1" title="Average rating">
          <Star className={college.averageRating === null ? 'size-3.5 fill-zinc-300 text-zinc-300' : 'size-3.5 fill-star text-star'} aria-hidden />
          <span className="sr-only">Average rating</span>
          {formatRating(college.averageRating)}
        </span>
        <span className="flex w-10 items-center gap-1 text-zinc-600" title="Number of reviews">
          <MessageSquareText className="size-3.5" aria-hidden />
          <span className="sr-only">Reviews</span>
          {college.reviewCount}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {actions}
        <Link
          to={`/colleges/${college._id}`}
          className="inline-flex h-9 items-center rounded-xl bg-ink px-4 text-xs font-semibold whitespace-nowrap text-white transition-colors hover:bg-zinc-800"
          aria-label={`View ${college.name}, ${plural(college.reviewCount, 'review')}`}
        >
          View college
        </Link>
      </div>
    </li>
  )
}

const collegeSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(150, 'At most 150 characters'),
  city: z.string().trim().min(2, 'At least 2 characters').max(80, 'At most 80 characters'),
  state: z.string().trim().min(2, 'At least 2 characters').max(80, 'At most 80 characters'),
  description: z.string().trim().max(2000, 'At most 2000 characters'),
})

type CollegeValues = z.infer<typeof collegeSchema>
const COLLEGE_FIELDS = ['name', 'city', 'state', 'description'] as const

// Adds a college, or edits the one passed in
export function CollegeFormModal({ college, onClose }: { college?: College; onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<CollegeValues>({
    resolver: zodResolver(collegeSchema),
    defaultValues: { name: college?.name ?? '', city: college?.city ?? '', state: college?.state ?? '', description: college?.description ?? '' },
  })
  const errors = form.formState.errors

  const mutation = useMutation({
    mutationFn: (values: CollegeValues) => (college ? collegesApi.update(college._id, values) : collegesApi.create(values)),
    onSuccess: () => {
      // Lists, the detail page and the dashboard totals all show college data
      queryClient.invalidateQueries({ queryKey: ['colleges'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success(college ? 'College updated' : 'College added')
      onClose()
    },
    onError: (error) => {
      const message = applyServerErrors(error, form.setError, COLLEGE_FIELDS)
      // "A college named X already exists" belongs under the name field
      if (message?.includes('already exists')) form.setError('name', { message })
      else setFormError(message)
    },
  })

  return (
    <Modal title={college ? 'Edit college' : 'Add a college'} onClose={onClose}>
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          setFormError(null)
          mutation.mutate(values)
        })}
      >
        {formError && <ErrorNote>{formError}</ErrorNote>}
        <Field label="Name" error={errors.name?.message}>
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} aria-invalid={Boolean(errors.name)} {...form.register('name')} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" error={errors.city?.message}>
            {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} aria-invalid={Boolean(errors.city)} {...form.register('city')} />}
          </Field>
          <Field label="State" error={errors.state?.message}>
            {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} aria-invalid={Boolean(errors.state)} {...form.register('state')} />}
          </Field>
        </div>
        <Field label="Description" error={errors.description?.message} hint="Optional">
          {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} aria-invalid={Boolean(errors.description)} {...form.register('description')} />}
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {college ? 'Save changes' : 'Add college'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
