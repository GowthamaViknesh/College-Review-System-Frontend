import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { authApi } from '../api/resources'
import { useToast } from '../components/Toast'
import { Button, ErrorNote } from '../components/ui'
import { errorMessage } from '../lib/api'
import { applyServerErrors } from '../lib/forms'
import { AuthShell, PillInput } from './AuthPages'

// The API sends at most one code a minute to an account
const RESEND_SECONDS = 60

const backToLogin = (
  <>
    Remembered it?{' '}
    <Link to="/login" className="font-semibold text-ink underline underline-offset-4">
      Back to login
    </Link>
  </>
)

// ---------- Step 1: ask for a code ----------

const forgotSchema = z.object({ email: z.email('Enter a valid email address') })
type ForgotValues = z.infer<typeof forgotSchema>

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } })

  const mutation = useMutation({
    mutationFn: ({ email }: ForgotValues) => authApi.forgotPassword(email),
    // The address goes along in the link, so reloading the next page does not lose it
    onSuccess: (_result, { email }) => navigate(`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`),
    onError: (error) => setFormError(applyServerErrors(error, form.setError, ['email'])),
  })

  return (
    <AuthShell title="Forgot password?" subtitle="Enter the email of your account and we will send you a 6-digit code to reset it." footer={backToLogin}>
      <form
        noValidate
        className="space-y-5"
        onSubmit={form.handleSubmit((values) => {
          setFormError(null)
          mutation.mutate(values)
        })}
      >
        {formError && <ErrorNote>{formError}</ErrorNote>}
        <PillInput label="Email" type="email" autoComplete="email" placeholder="you@example.com" error={form.formState.errors.email?.message} {...form.register('email')} />
        <Button type="submit" className="!mt-8 !h-14 w-full !rounded-full !text-base" loading={mutation.isPending}>
          Send code
        </Button>
      </form>
    </AuthShell>
  )
}

// ---------- Step 2: enter the code and a new password ----------

// The same rules the API applies
const resetSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Enter the 6 digits from the email'),
    newPassword: z.string().min(8, 'At least 8 characters').max(72, 'At most 72 characters'),
    confirmPassword: z.string().min(1, 'Type the new password again'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, { path: ['confirmPassword'], message: 'The two passwords do not match' })
type ResetValues = z.infer<typeof resetSchema>

// Counts down from a number of seconds to zero; restart() starts it again
function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    if (left <= 0) return
    const timer = setTimeout(() => setLeft((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [left])
  return { left, restart: () => setLeft(seconds) }
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''

  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { code: '', newPassword: '', confirmPassword: '' } })
  const errors = form.formState.errors
  // A code was sent just before arriving here, so the wait starts straight away
  const resend = useCountdown(RESEND_SECONDS)

  const mutation = useMutation({
    mutationFn: ({ code, newPassword }: ResetValues) => authApi.resetPassword({ email, code, newPassword }),
    onSuccess: () => {
      toast.success('Password changed. Log in with your new password.')
      navigate('/login', { replace: true })
    },
    onError: (error) => setFormError(applyServerErrors(error, form.setError, ['code', 'newPassword'])),
  })

  const sendAgain = useMutation({
    mutationFn: () => authApi.forgotPassword(email),
    onSuccess: () => {
      resend.restart()
      form.resetField('code')
      toast.success('A new code is on its way. The earlier one no longer works.')
    },
    onError: (error) => setFormError(errorMessage(error)),
  })

  // Opened directly, without an address to reset: start from the beginning
  if (!email) return <Navigate to="/forgot-password" replace />

  return (
    <AuthShell
      title="Check your email"
      subtitle={
        <>
          If <strong className="font-semibold text-ink">{email}</strong> has an account, a 6-digit code is on its way to it. The code works for 10 minutes.
        </>
      }
      footer={backToLogin}
    >
      <form
        noValidate
        className="space-y-5"
        onSubmit={form.handleSubmit((values) => {
          setFormError(null)
          mutation.mutate(values)
        })}
      >
        {formError && <ErrorNote>{formError}</ErrorNote>}
        <PillInput
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="6 digits"
          className="font-mono tracking-[0.4em] placeholder:font-sans placeholder:tracking-normal"
          error={errors.code?.message}
          {...form.register('code')}
        />
        <PillInput label="New password" type="password" autoComplete="new-password" placeholder="At least 8 characters" error={errors.newPassword?.message} {...form.register('newPassword')} />
        <PillInput
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          placeholder="Type it again"
          error={errors.confirmPassword?.message}
          {...form.register('confirmPassword')}
        />
        <Button type="submit" className="!mt-8 !h-14 w-full !rounded-full !text-base" loading={mutation.isPending}>
          Change password
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-600">
        No email? Check your spam folder, or{' '}
        {resend.left > 0 ? (
          <span>send a new code in {resend.left}s.</span>
        ) : (
          <button type="button" className="cursor-pointer font-semibold text-ink underline underline-offset-4 disabled:text-zinc-400" disabled={sendAgain.isPending} onClick={() => sendAgain.mutate()}>
            send a new code
          </button>
        )}
      </p>
    </AuthShell>
  )
}
