import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, GraduationCap, Mail, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { authApi } from '../api/resources'
import adminImage from '../assets/admin-cutout.webp'
import studentImage from '../assets/student-cutout.webp'
import { useAuth } from '../auth/AuthContext'
import { PageHeader } from '../components/Layout'
import { PicturePicker, uploadErrorMessage } from '../components/PicturePicker'
import { useToast } from '../components/Toast'
import { Badge, Button, Card, ErrorNote, Field, Input } from '../components/ui'
import { displayName, formatDate, plural } from '../lib/format'
import { applyServerErrors, NOT_SAVED } from '../lib/forms'

// The same rules the API applies
const detailsSchema = z.object({
  username: z.string().trim().min(3, 'At least 3 characters').max(30, 'At most 30 characters'),
  email: z.email('Enter a valid email address'),
})

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'At least 8 characters').max(72, 'At most 72 characters'),
    confirmPassword: z.string().min(1, 'Type the new password again'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, { path: ['confirmPassword'], message: 'The two passwords do not match' })
  .refine((values) => values.newPassword !== values.currentPassword, { path: ['newPassword'], message: 'Choose a password different from your current one' })

type DetailsValues = z.infer<typeof detailsSchema>
type PasswordValues = z.infer<typeof passwordSchema>

function DetailsForm() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<DetailsValues>({ resolver: zodResolver(detailsSchema), defaultValues: { username: user?.username ?? '', email: user?.email ?? '' } })
  const { errors, isDirty } = form.formState

  const mutation = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: ({ data }) => {
      // The name is shown in the sidebar, on reviews and in the users list
      queryClient.invalidateQueries()
      form.reset({ username: data.user.username, email: data.user.email })
      toast.success('Profile updated')
    },
    onError: (error) => {
      const message = applyServerErrors(error, form.setError, ['username', 'email'])
      setFormError(message)
      toast.error(message ?? NOT_SAVED)
    },
  })

  return (
    <Card>
      <h2 className="text-xl font-medium">Account details</h2>
      <p className="mt-0.5 mb-5 text-sm text-zinc-600">Your username is shown next to the reviews you write.</p>
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          setFormError(null)
          mutation.mutate(values)
        })}
      >
        {formError && <ErrorNote>{formError}</ErrorNote>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username" error={errors.username?.message}>
            {({ id, describedBy }) => <Input id={id} autoComplete="username" aria-describedby={describedBy} aria-invalid={Boolean(errors.username)} {...form.register('username')} />}
          </Field>
          <Field label="Email" error={errors.email?.message}>
            {({ id, describedBy }) => <Input id={id} type="email" autoComplete="email" aria-describedby={describedBy} aria-invalid={Boolean(errors.email)} {...form.register('email')} />}
          </Field>
        </div>
        <div className="flex justify-end gap-3">
          {isDirty && (
            <Button variant="secondary" onClick={() => form.reset()}>
              Discard changes
            </Button>
          )}
          <Button type="submit" loading={mutation.isPending} disabled={!isDirty}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  )
}

// Unlike the other forms there is nothing to save afterwards: choosing a picture uploads it
function PictureForm() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [error, setError] = useState<string | null>(null)

  const finish = (message: string) => () => {
    // The picture is shown in the sidebar, on reviews and in the users list
    queryClient.invalidateQueries()
    toast.success(message)
  }
  const fail = (error: unknown) => {
    setError(uploadErrorMessage(error))
    toast.error(uploadErrorMessage(error))
  }
  const upload = useMutation({ mutationFn: authApi.uploadAvatar, onMutate: () => setError(null), onSuccess: finish('Profile picture updated'), onError: fail })
  const remove = useMutation({ mutationFn: authApi.removeAvatar, onMutate: () => setError(null), onSuccess: finish('Profile picture removed'), onError: fail })

  return (
    <Card>
      <h2 className="text-xl font-medium">Profile picture</h2>
      <p className="mt-0.5 mb-5 text-sm text-zinc-600">Shown next to your name and the reviews you write. It is cropped to a square.</p>
      <PicturePicker
        label="Your picture"
        preview={user?.avatar ?? null}
        busy={upload.isPending || remove.isPending}
        error={error}
        onPick={(file) => upload.mutate(file)}
        onRemove={() => remove.mutate()}
      />
    </Card>
  )
}

function PasswordForm() {
  const toast = useToast()
  const { keepSession } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } })
  const errors = form.formState.errors

  const mutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: PasswordValues) => authApi.changePassword({ currentPassword, newPassword }),
    onSuccess: ({ data }) => {
      // The change logged out every device. These tokens keep this one logged in.
      keepSession(data)
      form.reset()
      toast.success('Password changed. Other devices have been logged out.')
    },
    onError: (error) => {
      const message = applyServerErrors(error, form.setError, ['currentPassword', 'newPassword'])
      setFormError(message)
      toast.error(message ?? NOT_SAVED)
    },
  })

  return (
    <Card>
      <h2 className="text-xl font-medium">Password</h2>
      <p className="mt-0.5 mb-5 text-sm text-zinc-600">Enter your current password to set a new one. Changing it logs you out on every other device.</p>
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          setFormError(null)
          mutation.mutate(values)
        })}
      >
        {formError && <ErrorNote>{formError}</ErrorNote>}
        <Field label="Current password" error={errors.currentPassword?.message}>
          {({ id, describedBy }) => (
            <Input id={id} type="password" autoComplete="current-password" aria-describedby={describedBy} aria-invalid={Boolean(errors.currentPassword)} {...form.register('currentPassword')} />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" error={errors.newPassword?.message} hint="At least 8 characters">
            {({ id, describedBy }) => (
              <Input id={id} type="password" autoComplete="new-password" aria-describedby={describedBy} aria-invalid={Boolean(errors.newPassword)} {...form.register('newPassword')} />
            )}
          </Field>
          <Field label="Confirm new password" error={errors.confirmPassword?.message}>
            {({ id, describedBy }) => (
              <Input id={id} type="password" autoComplete="new-password" aria-describedby={describedBy} aria-invalid={Boolean(errors.confirmPassword)} {...form.register('confirmPassword')} />
            )}
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={mutation.isPending}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  )
}

export function ProfilePage() {
  const { user, permissions, isReviewer } = useAuth()
  if (!user) return null

  return (
    <>
      <PageHeader title="My profile" subtitle="Your account, and what your role lets you do" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* Who you are: read-only facts about the account */}
        <Card className="self-start overflow-hidden !p-0">
          <div className="flex h-44 items-end justify-center overflow-hidden bg-zinc-200/70">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="size-full object-cover" />
            ) : (
              <img src={isReviewer ? studentImage : adminImage} alt="" className="h-full object-contain object-bottom" />
            )}
          </div>
          <div className="p-5">
            <h2 className="truncate text-2xl leading-tight font-medium">{displayName(user.username)}</h2>
            <div className="mt-2">
              <Badge tone="dark">
                <ShieldCheck className="size-3" aria-hidden />
                <span className="capitalize">{user.role?.name ?? 'No role'}</span>
              </Badge>
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex items-center gap-2.5">
                <Mail className="size-4 shrink-0 text-zinc-500" aria-hidden />
                <dt className="sr-only">Email</dt>
                <dd className="truncate">{user.email}</dd>
              </div>
              {user.college && (
                <div className="flex items-center gap-2.5">
                  <GraduationCap className="size-4 shrink-0 text-zinc-500" aria-hidden />
                  <dt className="sr-only">College</dt>
                  <dd className="truncate">{user.college.name}</dd>
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <CalendarDays className="size-4 shrink-0 text-zinc-500" aria-hidden />
                <dt className="sr-only">Member since</dt>
                <dd>Member since {formatDate(user.createdAt)}</dd>
              </div>
            </dl>

            <h3 className="mt-6 text-sm font-medium">What you can do</h3>
            <p className="mt-0.5 text-xs text-zinc-500">{plural(permissions.length, 'permission')} from your role. An administrator can change your role.</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {permissions.map((permission) => (
                <li key={permission} className="rounded-lg bg-white px-2 py-1 font-mono text-[11px] font-medium ring-1 ring-zinc-200">
                  {permission}
                </li>
              ))}
              {permissions.length === 0 && <li className="text-sm text-zinc-500">Your role has no permissions yet.</li>}
            </ul>
          </div>
        </Card>

        {/* What you can change */}
        <div className="min-w-0 space-y-6">
          <PictureForm />
          <DetailsForm />
          <PasswordForm />
        </div>
      </div>
    </>
  )
}
