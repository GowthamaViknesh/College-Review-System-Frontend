import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { reviewsApi } from '../api/resources'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../lib/api'
import { displayName, formatDate } from '../lib/format'
import { applyServerErrors } from '../lib/forms'
import type { Review } from '../lib/types'
import { useToast } from './Toast'
import { Avatar, Button, ConfirmDialog, ErrorNote, Field, Modal, StarInput, Stars, Textarea } from './ui'

const reviewSchema = z.object({
  rating: z.number().int().min(1, 'Choose a rating from 1 to 5 stars').max(5),
  comment: z.string().trim().min(10, 'Write at least 10 characters').max(2000, 'At most 2000 characters'),
})

type ReviewValues = z.infer<typeof reviewSchema>

// A new, edited or deleted review changes the review lists, the college's average and the dashboard figures
function refreshAfterReviewChange(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['reviews'] })
  queryClient.invalidateQueries({ queryKey: ['colleges'] })
  queryClient.invalidateQueries({ queryKey: ['stats'] })
}

// The rating and comment fields, used both to write a new review and to edit an existing one
export function ReviewForm({ collegeId, review, onDone, onCancel }: { collegeId: string; review?: Review; onDone?: () => void; onCancel?: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<ReviewValues>({ resolver: zodResolver(reviewSchema), defaultValues: { rating: review?.rating ?? 0, comment: review?.comment ?? '' } })
  const errors = form.formState.errors

  const mutation = useMutation({
    mutationFn: (values: ReviewValues) => (review ? reviewsApi.update(review._id, values) : reviewsApi.create({ ...values, college: collegeId })),
    onSuccess: () => {
      refreshAfterReviewChange(queryClient)
      toast.success(review ? 'Review updated' : 'Thanks for your review')
      form.reset({ rating: 0, comment: '' })
      onDone?.()
    },
    onError: (error) => setFormError(applyServerErrors(error, form.setError, ['rating', 'comment'])),
  })

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit((values) => {
        setFormError(null)
        mutation.mutate(values)
      })}
    >
      {formError && <ErrorNote>{formError}</ErrorNote>}
      <div>
        <p className="mb-1.5 text-sm font-semibold">Your rating</p>
        <Controller control={form.control} name="rating" render={({ field }) => <StarInput value={field.value} onChange={field.onChange} />} />
        {errors.rating && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.rating.message}</p>}
      </div>
      <Field label="Your review" error={errors.comment?.message} hint="What should a future student know? At least 10 characters.">
        {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} aria-invalid={Boolean(errors.comment)} {...form.register('comment')} />}
      </Field>
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={mutation.isPending}>
          {review ? 'Save changes' : 'Post review'}
        </Button>
      </div>
    </form>
  )
}

// One review, with edit and delete buttons for whoever is allowed to use them.
// showCollege swaps the author line for the college name, for a list of one person's reviews.
export function ReviewCard({ review, showCollege = false }: { review: Review; showCollege?: boolean }) {
  const { user, can } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const isMine = Boolean(user && review.user?._id === user._id)
  // Only the author can edit. The author can always delete; so can anyone with the moderation permission.
  const canEdit = isMine && can('review:create')
  const canDelete = isMine || can('review:delete:any')
  const author = review.user ? displayName(review.user.username) : 'Deleted user'

  const remove = useMutation({
    mutationFn: () => reviewsApi.remove(review._id),
    onSuccess: () => {
      refreshAfterReviewChange(queryClient)
      toast.success('Review deleted')
      setConfirming(false)
    },
  })

  return (
    <li className="rounded-3xl bg-panel p-5">
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name={showCollege ? (review.college?.name ?? '?') : author} src={showCollege ? null : review.user?.avatar} />
        <div className="min-w-0 flex-1">
          {showCollege && review.college ? (
            <Link to={`/colleges/${review.college._id}`} className="font-display text-base leading-tight font-medium underline-offset-4 hover:underline">
              {review.college.name}
            </Link>
          ) : (
            <p className="font-display text-base leading-tight font-medium">
              {author}
              {isMine && <span className="ml-2 font-sans text-xs font-medium text-zinc-500">(you)</span>}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Stars value={review.rating} />
            <span className="text-xs text-zinc-500">
              {formatDate(review.createdAt)}
              {review.updatedAt !== review.createdAt && ' · edited'}
            </span>
          </div>
        </div>
        {(canEdit || canDelete) && (
          <div className="flex gap-1">
            {canEdit && (
              <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="Edit review">
                <Pencil className="size-4" aria-hidden />
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" size="icon" onClick={() => setConfirming(true)} aria-label={`Delete review by ${author}`}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        )}
      </div>
      <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-zinc-700">{review.comment}</p>

      {editing && review.college && (
        <Modal title="Edit your review" onClose={() => setEditing(false)}>
          <ReviewForm collegeId={review.college._id} review={review} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
        </Modal>
      )}
      {confirming && (
        <ConfirmDialog
          title="Delete this review?"
          confirmLabel="Delete review"
          loading={remove.isPending}
          error={remove.error ? errorMessage(remove.error) : null}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirming(false)}
        >
          {isMine ? 'Your rating will stop counting towards the college average. You can write a new review afterwards.' : `This removes ${author}'s review and its rating. It cannot be undone.`}
        </ConfirmDialog>
      )}
    </li>
  )
}
