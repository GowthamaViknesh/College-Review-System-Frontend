import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPin, MessageSquareText, Star } from 'lucide-react'
import { useState, type ReactNode, type SelectHTMLAttributes } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { collegesApi } from '../api/resources'
import { useAuth } from '../auth/AuthContext'
import { formatRating, plural, thumbnail } from '../lib/format'
import { applyServerErrors } from '../lib/forms'
import { placeOptions, usePlaces } from '../lib/places'
import type { College } from '../lib/types'
import { PicturePicker, uploadErrorMessage, usePreview } from './PicturePicker'
import { useToast } from './Toast'
import { Button, ErrorNote, Field, Input, Modal, Select, Textarea } from './ui'

// The square tile for a college: its picture, or its initial when it has none
export function CollegeMark({ name, image, className = 'size-12 text-xl' }: { name: string; image?: string | null; className?: string }) {
  if (image) return <img src={thumbnail(image, 64)} alt="" className={`shrink-0 rounded-2xl bg-white object-cover shadow-sm ${className}`} />
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
      <CollegeMark name={college.name} image={college.image} />
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
          to={`/colleges/${college.collegeId}`}
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
  country: z.string().trim().min(2, 'Choose a country').max(80, 'At most 80 characters'),
  state: z.string().trim().min(2, 'Choose a state').max(80, 'At most 80 characters'),
  city: z.string().trim().min(2, 'Choose a city').max(80, 'At most 80 characters'),
  address: z.string().trim().max(300, 'At most 300 characters'),
  description: z.string().trim().max(2000, 'At most 2000 characters'),
})

type CollegeValues = z.infer<typeof collegeSchema>
const COLLEGE_FIELDS = ['name', 'country', 'state', 'city', 'address', 'description'] as const

// Most colleges added here are Indian, so a new one starts there; any country can be chosen instead
const DEFAULT_COUNTRY = 'India'

interface PlaceSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  value: string
  options: string[]
  // What the empty first choice says, e.g. "Select state"
  placeholder: string
  // The lists are still downloading
  loading: boolean
  // True when the level above is chosen but has nothing listed under it (a country with no states, a
  // state with no cities): the place is then typed instead of picked
  typed: boolean
  onChange: (value: string) => void
}

// One of the country, state and city dropdowns
function PlaceSelect({ value, options, placeholder, loading, typed, onChange, disabled, ...props }: PlaceSelectProps) {
  if (typed) return <Input value={value} placeholder="Type the name" onChange={(event) => onChange(event.target.value)} {...(props as object)} />

  // A college saved with a name that is not in the list (spelt differently, or typed) keeps that name as a choice
  const all = value && !options.includes(value) ? [value, ...options] : options
  return (
    <Select value={value} disabled={disabled || loading} onChange={(event) => onChange(event.target.value)} {...props}>
      <option value="">{loading ? 'Loading…' : placeholder}</option>
      {all.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </Select>
  )
}

// Adds a college, or edits the one passed in
export function CollegeFormModal({ college, onClose }: { college?: College; onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { can } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)

  // The picture is its own request, made after the details are saved. Setting it needs permission to edit
  // colleges, so someone who may only add them does not see the field.
  const canSetPicture = can('college:update')
  const [picked, setPicked] = useState<File | null>(null)
  const [removed, setRemoved] = useState(false)
  const pickedPreview = usePreview(picked)
  const preview = pickedPreview ?? (removed ? null : (college?.image ?? null))

  const form = useForm<CollegeValues>({
    resolver: zodResolver(collegeSchema),
    defaultValues: {
      name: college?.name ?? '',
      country: college?.country ?? DEFAULT_COUNTRY,
      state: college?.state ?? '',
      city: college?.city ?? '',
      address: college?.address ?? '',
      description: college?.description ?? '',
    },
  })
  const errors = form.formState.errors

  // Country, then the states of that country, then the cities of that state
  const places = usePlaces()
  const [country, state, city] = form.watch(['country', 'state', 'city'])
  const { countries, states, cities } = placeOptions(places, country, state)
  const loadingPlaces = !places
  // Choosing a different country or state empties what was chosen beneath it, which no longer belongs
  const choose = (field: 'country' | 'state' | 'city', value: string) => {
    form.setValue(field, value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
    if (field === 'country') form.setValue('state', '')
    if (field !== 'city') form.setValue('city', '')
  }

  const mutation = useMutation({
    mutationFn: async (values: CollegeValues) => {
      const { data } = await (college ? collegesApi.update(college.collegeId, values) : collegesApi.create(values))
      const id = data.college.collegeId

      // The details are saved by this point. A problem with the picture is reported on its own,
      // so it does not look as if nothing was saved.
      try {
        if (picked) await collegesApi.uploadImage(id, picked)
        else if (removed && college?.image) await collegesApi.removeImage(id)
        return null
      } catch (error) {
        return uploadErrorMessage(error)
      }
    },
    onSuccess: (pictureError) => {
      // Lists, the detail page and the dashboard totals all show college data
      queryClient.invalidateQueries({ queryKey: ['colleges'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      if (pictureError) toast.error(`The college was saved, but its picture was not. ${pictureError}`)
      else toast.success(college ? 'College updated' : 'College added')
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
    <Modal title={college ? 'Edit college' : 'Add a college'} onClose={onClose} wide={canSetPicture}>
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          setFormError(null)
          mutation.mutate(values)
        })}
      >
        {formError && <ErrorNote>{formError}</ErrorNote>}
        {/* The details on the left and the picture in its own column on the right, which keeps the dialog short */}
        <div className={canSetPicture ? 'grid gap-x-6 gap-y-4 sm:grid-cols-[minmax(0,1fr)_18rem]' : undefined}>
          <div className="min-w-0 space-y-4">
            <Field label="Name" error={errors.name?.message}>
              {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} aria-invalid={Boolean(errors.name)} {...form.register('name')} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Country" error={errors.country?.message}>
                {({ id, describedBy }) => (
                  <PlaceSelect
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={Boolean(errors.country)}
                    value={country}
                    options={countries}
                    placeholder="Select country"
                    loading={loadingPlaces}
                    typed={false}
                    onChange={(value) => choose('country', value)}
                  />
                )}
              </Field>
              <Field label="State" error={errors.state?.message}>
                {({ id, describedBy }) => (
                  <PlaceSelect
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={Boolean(errors.state)}
                    value={state}
                    options={states}
                    placeholder={country ? 'Select state' : 'Choose a country first'}
                    loading={loadingPlaces}
                    disabled={!country}
                    typed={!loadingPlaces && Boolean(country) && states.length === 0}
                    onChange={(value) => choose('state', value)}
                  />
                )}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City" error={errors.city?.message}>
                {({ id, describedBy }) => (
                  <PlaceSelect
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={Boolean(errors.city)}
                    value={city}
                    options={cities}
                    placeholder={state ? 'Select city' : 'Choose a state first'}
                    loading={loadingPlaces}
                    disabled={!state}
                    typed={!loadingPlaces && Boolean(state) && cities.length === 0}
                    onChange={(value) => choose('city', value)}
                  />
                )}
              </Field>
              <Field label="Address" error={errors.address?.message}>
                {({ id, describedBy }) => (
                  <Input id={id} placeholder="Street, area, postcode" autoComplete="off" aria-describedby={describedBy} aria-invalid={Boolean(errors.address)} {...form.register('address')} />
                )}
              </Field>
            </div>
            <Field label="Description" error={errors.description?.message} hint="Optional">
              {({ id, describedBy }) => <Textarea id={id} className="block !min-h-20" aria-describedby={describedBy} aria-invalid={Boolean(errors.description)} {...form.register('description')} />}
            </Field>
          </div>
          {canSetPicture && (
            <PicturePicker
              label="Picture"
              stacked
              preview={preview}
              onPick={(file) => {
                setPicked(file)
                setRemoved(false)
              }}
              onRemove={() => {
                setPicked(null)
                setRemoved(true)
              }}
            />
          )}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" className="hover:!bg-red-600 hover:!text-white hover:!ring-red-600" onClick={onClose}>
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
