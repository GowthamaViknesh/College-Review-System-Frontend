import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Eye, EyeOff, Star } from 'lucide-react'
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { z } from 'zod'
import { authApi, collegesApi } from '../api/resources'
import raisingHand from '../assets/Raising hand-bro.svg'
import { useAuth } from '../auth/AuthContext'
import { Button, ErrorNote, Spinner } from '../components/ui'
import { cn, formatRating, plural } from '../lib/format'
import { applyServerErrors } from '../lib/forms'

// The same rules the API applies, so most mistakes are caught before a request is sent
const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

const registerSchema = z.object({
  username: z.string().trim().min(3, 'At least 3 characters').max(30, 'At most 30 characters'),
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'At least 8 characters').max(72, 'At most 72 characters'),
})

type LoginValues = z.infer<typeof loginSchema>
type RegisterValues = z.infer<typeof registerSchema>

interface PillInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

// A rounded field with its label above it and, for passwords, a button to show what was typed
const PillInput = forwardRef<HTMLInputElement, PillInputProps>(function PillInput({ label, error, type = 'text', className, ...props }, ref) {
  const id = useId()
  const [shown, setShown] = useState(false)
  const isPassword = type === 'password'

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          ref={ref}
          type={isPassword && shown ? 'text' : type}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            'h-14 w-full rounded-full border-[1.5px] bg-white px-6 text-base placeholder:text-zinc-400 focus:border-ink focus:ring-1 focus:ring-ink focus:outline-none',
            error ? 'border-red-500' : 'border-zinc-300',
            isPassword && 'pr-14',
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((current) => !current)}
            className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-zinc-500 hover:text-ink"
            aria-label={shown ? 'Hide password' : 'Show password'}
            aria-pressed={shown}
          >
            {shown ? <Eye className="size-5" aria-hidden /> : <EyeOff className="size-5" aria-hidden />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 pl-6 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  )
})

function Brand({ className }: { className?: string }) {
  return (
    <p className={cn('flex items-center gap-3 text-lg font-medium', className)}>
      <span className="grid size-11 place-items-center rounded-2xl bg-ink text-xl font-semibold text-white">C.</span>
      College Reviews
    </p>
  )
}

// The left half of the page: brand, the illustration, the tagline, and the colleges students rate highest
function Showcase() {
  // Reading colleges is public, so the page can show live ratings before anyone signs in
  const top = useQuery({
    queryKey: ['colleges', 'showcase'],
    queryFn: () => collegesApi.list({ sort: 'rating', limit: 3 }).then((result) => result.data.colleges.filter((college) => college.averageRating !== null)),
    staleTime: 60_000,
    retry: false,
  })

  return (
    // Exactly one screen tall and pinned, so the picture shrinks to fit rather than pushing the text off the bottom
    <div className="sticky top-0 hidden h-screen flex-col bg-panel px-12 py-8 lg:flex xl:px-16">
      <Brand />

      <div className="flex min-h-0 flex-1 items-center justify-center py-4">
        <img src={raisingHand} alt="" className="h-full max-h-[34rem] w-full object-contain" />
      </div>

      <div>
        <h2 className="max-w-lg text-3xl leading-tight font-medium xl:text-4xl">Choose your college with confidence.</h2>
        <p className="mt-3 max-w-md text-base text-zinc-600">Honest ratings from students. One review per student per college, so every average is fair.</p>

        {top.data && top.data.length > 0 && (
          <ul className="mt-6 grid grid-cols-3 gap-3" aria-label="Top rated colleges">
            {top.data.map((college) => (
              <li key={college._id} className="min-w-0 bg-white px-4 py-3">
                <p className="truncate text-sm font-medium">{college.name}</p>
                <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-zinc-600">
                  <Star className="size-4 fill-star text-star" aria-hidden />
                  <span className="font-medium text-ink">{formatRating(college.averageRating)}</span>
                  <span aria-hidden>·</span>
                  {plural(college.reviewCount, 'review')}
                </p>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-5 text-xs text-zinc-500">Created by Gowtham</p>
      </div>
    </div>
  )
}

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: ReactNode; children: ReactNode; footer: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner label="Signing you in" />
  // Already signed in: go to where they were headed, or the dashboard
  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/dashboard'} replace />

  return (
    // Two equal halves filling the whole window: the picture on the left, the form on the right
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <Showcase />

      <div className="flex min-h-screen flex-col justify-center px-6 py-10 sm:px-12 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <Brand className="mb-10 lg:hidden" />
          <h1 className="text-4xl leading-none font-medium sm:text-5xl">{title}</h1>
          <p className="mt-4 mb-10 text-base text-zinc-600">{subtitle}</p>
          {children}
          <p className="mt-10 text-center text-base text-zinc-700">{footer}</p>
        </div>
      </div>
    </div>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })
  const errors = form.formState.errors

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ data }) => login(data.token),
    onError: (error) => setFormError(applyServerErrors(error, form.setError, ['email', 'password'])),
  })

  function submit(values: LoginValues) {
    setFormError(null)
    mutation.mutate(values)
  }

  return (
    <AuthShell
      title="Welcome back!"
      subtitle="Log in to read reviews and share your own."
      footer={
        <>
          Are you a student?{' '}
          <Link to="/register" className="font-semibold text-ink underline underline-offset-4">
            Register now
          </Link>
          {/* Only students sign themselves up; everyone else is given an account */}
          <span className="mt-2 block text-sm text-zinc-500">Teachers and administrators get their account from an administrator.</span>
        </>
      }
    >
      <form noValidate className="space-y-5" onSubmit={form.handleSubmit(submit)}>
        {formError && <ErrorNote>{formError}</ErrorNote>}
        <PillInput label="Email" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...form.register('email')} />
        <PillInput label="Password" type="password" autoComplete="current-password" placeholder="Your password" error={errors.password?.message} {...form.register('password')} />
        <Button type="submit" className="!mt-8 !h-14 w-full !rounded-full !text-base" loading={mutation.isPending}>
          Login
        </Button>
      </form>
    </AuthShell>
  )
}

export function RegisterPage() {
  const { login } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: { username: '', email: '', password: '' } })
  const errors = form.formState.errors

  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: ({ data }) => login(data.token),
    onError: (error) => setFormError(applyServerErrors(error, form.setError, ['username', 'email', 'password'])),
  })

  return (
    <AuthShell
      title="Student sign-up"
      subtitle={
        <>
          This form is for <strong className="font-semibold text-ink">students</strong>. Create a free account to rate and review colleges.
        </>
      }
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-ink underline underline-offset-4">
            Login
          </Link>
          <span className="mt-2 block text-sm text-zinc-500">Not a student? Teachers and administrators get their account from an administrator.</span>
        </>
      }
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
        <PillInput label="Username" autoComplete="username" placeholder="At least 3 characters" error={errors.username?.message} {...form.register('username')} />
        <PillInput label="Email" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...form.register('email')} />
        <PillInput label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" error={errors.password?.message} {...form.register('password')} />
        <Button type="submit" className="!mt-8 !h-14 w-full !rounded-full !text-base" loading={mutation.isPending}>
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
