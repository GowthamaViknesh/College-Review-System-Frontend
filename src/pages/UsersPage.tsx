import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { rolesApi, usersApi } from '../api/resources'
import { useAuth } from '../auth/AuthContext'
import { useCollegeOptions } from '../components/colleges'
import { PageHeader } from '../components/Layout'
import { PicturePicker, uploadErrorMessage, usePreview } from '../components/PicturePicker'
import { useToast } from '../components/Toast'
import { Avatar, Button, Card, ConfirmDialog, EmptyState, ErrorNote, Field, Input, Modal, PAGE_SIZES, PageSizeSelect, Pagination, Select, Spinner } from '../components/ui'
import { errorMessage } from '../lib/api'
import { displayName, formatAgo, formatDate, formatDateTime, plural } from '../lib/format'
import { applyServerErrors, NOT_SAVED } from '../lib/forms'
import type { User } from '../lib/types'

// A colour for each role, so a column of them can be read at a glance. The three roles the app starts
// with have fixed colours; roles an admin creates take one of the others, always the same one for a given name.
const ROLE_COLOURS: Record<string, { text: string; dot: string }> = {
  admin: { text: 'text-violet-700', dot: 'bg-violet-500' },
  teacher: { text: 'text-sky-700', dot: 'bg-sky-500' },
  student: { text: 'text-emerald-700', dot: 'bg-emerald-500' },
}
const OTHER_ROLE_COLOURS = [
  { text: 'text-amber-700', dot: 'bg-amber-500' },
  { text: 'text-rose-700', dot: 'bg-rose-500' },
  { text: 'text-teal-700', dot: 'bg-teal-500' },
  { text: 'text-orange-700', dot: 'bg-orange-500' },
  { text: 'text-fuchsia-700', dot: 'bg-fuchsia-500' },
]
const NO_ROLE_COLOUR = { text: 'text-zinc-600', dot: 'bg-zinc-400' }

function roleColour(name: string | undefined) {
  if (!name) return NO_ROLE_COLOUR
  const sum = [...name].reduce((total, char) => total + char.charCodeAt(0), 0)
  return ROLE_COLOURS[name] ?? OTHER_ROLE_COLOURS[sum % OTHER_ROLE_COLOURS.length]
}

// A user's role as coloured text with a softly pulsing dot before it. The role itself is changed in the Edit dialog.
function RoleTag({ name }: { name: string | undefined }) {
  const colour = roleColour(name)
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-semibold capitalize ${colour.text}`}>
      <span className="relative flex size-2" aria-hidden>
        {/* The ring that grows and fades; still for anyone who has asked their device for less motion */}
        <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-70 motion-reduce:hidden ${colour.dot}`} />
        <span className={`relative inline-flex size-2 rounded-full ${colour.dot}`} />
      </span>
      {name ?? 'No role'}
    </span>
  )
}
// The role the API gives to accounts when none is chosen, and the only one a non-admin may hand out
const DEFAULT_ROLE = 'student'
// The one role that needs no college
const ADMIN_ROLE = 'admin'

const userSchema = z.object({
  username: z.string().trim().min(3, 'At least 3 characters').max(30, 'At most 30 characters'),
  email: z.email('Enter a valid email address'),
  role: z.string(),
  // A collegeId, or empty for none (administrators only; the form checks that before sending)
  college: z.string(),
})
// A password is set only when the account is created; afterwards its owner changes it themselves
const createUserSchema = userSchema.extend({ password: z.string().min(8, 'At least 8 characters').max(72, 'At most 72 characters') })

type UserValues = z.infer<typeof userSchema> & { password?: string }

// Creates an account, or edits the one passed in. Laid out like the college form: details on the
// left, the picture in its own column on the right.
function UserFormModal({ user, roleNames, onClose }: { user?: User; roleNames: string[]; onClose: () => void }) {
  const { user: me, can } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<UserValues>({
    resolver: zodResolver(user ? userSchema : createUserSchema),
    defaultValues: { username: user?.username ?? '', email: user?.email ?? '', password: '', role: user?.role?.name ?? DEFAULT_ROLE, college: user?.college?.collegeId ?? '' },
  })
  const errors = form.formState.errors

  // Choosing a role other than the default needs role:assign, and nobody changes their own role
  const isMe = Boolean(user && user.userId === me?.userId)
  const canChooseRole = can('role:assign') && roleNames.length > 0 && !isMe

  // Placing someone in a college goes with assigning roles. Without it, a new student simply joins
  // the creator's own college, and an existing account's college is shown but not changed here.
  const canPlace = can('role:assign')
  const colleges = useCollegeOptions(canPlace)
  const role = form.watch('role')
  // Everyone belongs to a college except administrators, who look after all of them
  const collegeOptional = role === ADMIN_ROLE

  // The picture is its own request, made after the details are saved. Whoever creates an account may
  // give it one; changing it later needs permission to edit users.
  const canSetPicture = can('user:update') || (!user && can('user:create'))
  const [picked, setPicked] = useState<File | null>(null)
  const [removed, setRemoved] = useState(false)
  const pickedPreview = usePreview(picked)
  const preview = pickedPreview ?? (removed ? null : (user?.avatar ?? null))

  const mutation = useMutation({
    mutationFn: async ({ username, email, password, role, college }: UserValues) => {
      let saved: User
      if (user) {
        saved = user
        // Each part is sent only if it changed, so someone who may do one of them is not refused for the other
        const details = {
          ...((username !== user.username || email.toLowerCase() !== user.email) && { username, email }),
          ...(canPlace && college && college !== user.college?.collegeId && { college }),
        }
        if (Object.keys(details).length) saved = (await usersApi.update(user.userId, details)).data.user
        if (canChooseRole && role !== user.role?.name) saved = (await usersApi.setRole(user.userId, role)).data.user
      } else {
        // Someone who cannot place people sends no college: the API puts the student in their own
        saved = (await usersApi.create({ username, email, password: password ?? '', role, ...(canPlace && college && { college }) })).data.user
      }

      // The details are saved by this point. A problem with the picture is reported on its own,
      // so it does not look as if nothing was saved.
      let pictureError: string | null = null
      try {
        if (picked) await usersApi.uploadAvatar(saved.userId, picked)
        else if (removed && user?.avatar) await usersApi.removeAvatar(saved.userId)
      } catch (error) {
        pictureError = uploadErrorMessage(error)
      }
      return { saved, pictureError }
    },
    onSuccess: ({ saved, pictureError }) => {
      // Names and pictures also appear on reviews and, for your own account, in the sidebar
      queryClient.invalidateQueries()
      const name = displayName(saved.username)
      if (pictureError) toast.error(`${name} was saved, but the picture was not. ${pictureError}`)
      else toast.success(user ? `${name} updated` : `Account created for ${name}`)
      onClose()
    },
    onError: (error) => {
      const message = applyServerErrors(error, form.setError, ['username', 'email', 'password', 'role', 'college'])
      setFormError(message)
      toast.error(message ?? NOT_SAVED)
    },
  })

  // The role shown when it cannot be chosen
  const fixedRole = user ? (user.role?.name ?? '') : DEFAULT_ROLE

  const roleField = canChooseRole ? (
    <Field label="Role" error={errors.role?.message}>
      {({ id, describedBy }) => (
        <Select id={id} aria-describedby={describedBy} className="capitalize" {...form.register('role')}>
          {roleNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      )}
    </Field>
  ) : (
    // Nothing to choose: a new account is a student, and an existing one keeps the role it has.
    // Shown as the same dropdown, with that one role in it, so the form reads the same for everyone.
    <Field label="Role">
      {({ id }) => (
        <Select id={id} value={fixedRole} disabled className="capitalize" onChange={() => {}}>
          <option value={fixedRole}>{fixedRole || 'No role'}</option>
        </Select>
      )}
    </Field>
  )

  const collegeField = canPlace ? (
    <Field label="College" error={errors.college?.message} hint={collegeOptional ? 'Optional for an administrator.' : undefined}>
      {({ id, describedBy }) => (
        <Select id={id} aria-describedby={describedBy} aria-invalid={Boolean(errors.college)} disabled={colleges.isPending} {...form.register('college')}>
          <option value="">{colleges.isPending ? 'Loading…' : collegeOptional ? 'No college' : 'Select college'}</option>
          {colleges.data?.map((college) => (
            <option key={college.collegeId} value={college.collegeId}>
              {college.name}
            </option>
          ))}
        </Select>
      )}
    </Field>
  ) : (
    <div>
      <p className="mb-1.5 text-sm font-semibold">College</p>
      <p className="flex min-h-11 items-center rounded-xl bg-panel px-4 py-2 text-sm text-zinc-600">
        {user ? (
          <strong className="text-ink">{user.college?.name ?? 'Not assigned'}</strong>
        ) : me?.college ? (
          <span>
            <strong className="text-ink">{me.college.name}</strong>. New students join your own college.
          </span>
        ) : (
          <span className="font-medium text-red-600">You are not assigned to a college yet, so you cannot create accounts. Ask an administrator.</span>
        )}
      </p>
    </div>
  )

  return (
    <Modal title={user ? `Edit ${displayName(user.username)}` : 'Create a user'} onClose={onClose} wide={canSetPicture}>
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          setFormError(null)
          // The API says the same, but it is quicker to say it here
          if (canPlace && !collegeOptional && !values.college) return form.setError('college', { message: 'Choose the college this person belongs to' })
          mutation.mutate(values)
        })}
      >
        {formError && <ErrorNote>{formError}</ErrorNote>}
        <div className={canSetPicture ? 'grid gap-x-6 gap-y-4 sm:grid-cols-[minmax(0,1fr)_18rem]' : undefined}>
          <div className="min-w-0 space-y-4">
            <Field label="Username" error={errors.username?.message}>
              {({ id, describedBy }) => <Input id={id} autoComplete="off" aria-describedby={describedBy} aria-invalid={Boolean(errors.username)} {...form.register('username')} />}
            </Field>
            <Field label="Email" error={errors.email?.message} hint={user ? 'They log in with this, and password reset codes are sent to it.' : undefined}>
              {({ id, describedBy }) => <Input id={id} type="email" autoComplete="off" aria-describedby={describedBy} aria-invalid={Boolean(errors.email)} {...form.register('email')} />}
            </Field>
            {user ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {roleField}
                {collegeField}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Password" error={errors.password?.message} hint="At least 8 characters. Share it with the person.">
                  {({ id, describedBy }) => (
                    <Input id={id} type="password" autoComplete="new-password" aria-describedby={describedBy} aria-invalid={Boolean(errors.password)} {...form.register('password')} />
                  )}
                </Field>
                {roleField}
              </div>
            )}
            {!user && collegeField}
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
            {user ? 'Save changes' : 'Create user'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function UsersPage() {
  const { user: me, can } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()

  // user:read sees everyone. user:read:college (a teacher) sees the students of their own college only;
  // the API enforces that, this just words the page to match.
  const seesEveryone = can('user:read')
  const canRead = seesEveryone || can('user:read:college')
  const canAssign = can('role:assign')
  const collegeOptions = useCollegeOptions(seesEveryone)
  const [college, setCollege] = useState('')

  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)

  // Search as you type, after a short pause
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchText])

  const roles = useQuery({ queryKey: ['roles'], queryFn: () => rolesApi.list().then((result) => result.data.roles), enabled: can('role:read') })
  const roleNames = roles.data?.map((item) => item.name) ?? []

  const users = useQuery({
    queryKey: ['users', { search, role, college, page, pageSize }],
    queryFn: () => usersApi.list({ search, role, college, page, limit: pageSize }),
    placeholderData: keepPreviousData,
    enabled: canRead,
  })

  const remove = useMutation({
    mutationFn: (user: User) => usersApi.remove(user.userId),
    onSuccess: (_result, user) => {
      // Their reviews go with them, which changes college averages
      queryClient.invalidateQueries()
      toast.success(`${displayName(user.username)} deleted`)
      setDeleting(null)
    },
  })

  // Each column as wide as its contents need. Someone who sees every college gets a College column;
  // for a teacher it would say the same thing on every row.
  const columns = seesEveryone
    ? [['User', 'w-[17%]'], ['Email', 'w-[20%]'], ['Role', 'w-[11%]'], ['College', 'w-[17%]'], ['Joined', 'w-[11%]'], ['Last active', 'w-[13%]'], ['Actions', 'w-[11%]']]
    : [['User', 'w-[21%]'], ['Email', 'w-[22%]'], ['Role', 'w-[14%]'], ['Joined', 'w-[13%]'], ['Last active', 'w-[15%]'], ['Actions', 'w-[15%]']]

  const list = users.data?.data.users ?? []
  const total = users.data?.meta?.total

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={
          !canRead || total === undefined
            ? 'Create accounts for other people'
            : seesEveryone
              ? plural(total, 'account')
              : me?.college
                ? `${plural(total, 'student')} of ${me.college.name}`
                : 'Students of your college'
        }
        actions={
          can('user:create') && (
            <Button onClick={() => setCreating(true)}>
              <UserPlus className="size-4" aria-hidden />
              Create user
            </Button>
          )
        }
      />

      {!canRead ? (
        <EmptyState title="You can create accounts, but not list them">Your role can add new student accounts with the button above. Seeing the list of users needs the user:read permission.</EmptyState>
      ) : (
        <>
          {!seesEveryone && !me?.college && (
            <ErrorNote>You are not assigned to a college yet, so there are no students to show and you cannot create accounts. Ask an administrator to assign you one.</ErrorNote>
          )}
          <div className={`mb-5 grid gap-3 ${seesEveryone ? 'sm:grid-cols-[minmax(0,1fr)_11rem_13rem_9.5rem]' : 'sm:grid-cols-[minmax(0,1fr)_9.5rem]'}`}>
            <Input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search by username or email" aria-label="Search users" />
            {roleNames.length > 0 && (
              <Select
                value={role}
                onChange={(event) => {
                  setRole(event.target.value)
                  setPage(1)
                }}
                aria-label="Filter by role"
                className="capitalize"
              >
                <option value="">All roles</option>
                {roleNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            )}
            {seesEveryone && (
              <Select
                value={college}
                onChange={(event) => {
                  setCollege(event.target.value)
                  setPage(1)
                }}
                aria-label="Filter by college"
              >
                <option value="">All colleges</option>
                {collegeOptions.data?.map((option) => (
                  <option key={option.collegeId} value={option.collegeId}>
                    {option.name}
                  </option>
                ))}
              </Select>
            )}
            <PageSizeSelect
              what="Accounts"
              value={pageSize}
              onChange={(size) => {
                setPageSize(size)
                // Page 3 of 10-a-page is not page 3 of 50-a-page, so start again from the first
                setPage(1)
              }}
              className={seesEveryone && roleNames.length === 0 ? 'sm:col-start-4' : undefined}
            />
          </div>

          {users.isPending ? (
            <Spinner label="Loading users" />
          ) : users.isError ? (
            <ErrorNote>{errorMessage(users.error)}</ErrorNote>
          ) : list.length === 0 ? (
            <EmptyState title={seesEveryone ? 'No users match' : 'No students to show'}>
              {seesEveryone ? 'Try a different search, role or college.' : search ? 'No student of your college matches that search.' : 'Students of your college appear here once they sign up or you create their accounts.'}
            </EmptyState>
          ) : (
            <>
              <Card className={`relative overflow-x-auto p-2 transition-opacity ${users.isPlaceholderData ? 'opacity-60' : ''}`}>
                {/* Each column is as wide as its contents need (emails are longest, the two icons shortest), so the gaps between columns look alike */}
                <table className={`w-full table-fixed text-left text-sm ${seesEveryone ? 'min-w-[72rem]' : 'min-w-[62rem]'}`}>
                  <thead>
                    <tr className="text-sm text-zinc-700">
                      {columns.map(([heading, width]) => (
                        <th key={heading} scope="col" className={`${width} px-4 py-3 font-semibold`}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((user) => {
                      const isMe = user.userId === me?.userId
                      return (
                        <tr key={user.userId} className="border-t border-zinc-200/80">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={user.username} src={user.avatar} />
                              <div className="min-w-0">
                                <p className="truncate font-semibold">
                                  {displayName(user.username)}
                                  {isMe && <span className="ml-2 text-xs font-medium text-zinc-500">(you)</span>}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="truncate px-4 py-3 text-zinc-700" title={user.email}>
                            {user.email}
                          </td>
                          <td className="px-4 py-3">
                            <RoleTag name={user.role?.name} />
                          </td>
                          {seesEveryone && (
                            <td className="truncate px-4 py-3 text-zinc-700" title={user.college?.name}>
                              {user.college?.name ?? <span className="text-zinc-400">None</span>}
                            </td>
                          )}
                          <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{formatDate(user.createdAt)}</td>
                          {/* In words, with the exact time on hover; "Never" for an account nobody has logged in to */}
                          <td className="px-4 py-3 whitespace-nowrap text-zinc-600" title={user.lastActiveAt ? formatDateTime(user.lastActiveAt) : undefined}>
                            {user.lastActiveAt ? formatAgo(user.lastActiveAt) : <span className="text-zinc-400">Never</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="-ml-2 flex items-center gap-1">
                              {/* The API lets someone without role:assign edit students only, so the button follows the same rule */}
                              {can('user:update') && (canAssign || user.role?.name === DEFAULT_ROLE) && (
                                <Button variant="ghost" size="icon" onClick={() => setEditing(user)} aria-label={`Edit ${displayName(user.username)}`} title="Edit">
                                  <Pencil className="size-4" aria-hidden />
                                </Button>
                              )}
                              {can('user:delete') && !isMe && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="hover:!bg-red-50 hover:!text-red-600"
                                  onClick={() => setDeleting(user)}
                                  aria-label={`Delete ${displayName(user.username)}`}
                                  title="Delete"
                                >
                                  <Trash2 className="size-4" aria-hidden />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
              <Pagination meta={users.data?.meta} onPage={setPage} always />
            </>
          )}
        </>
      )}

      {creating && <UserFormModal roleNames={roleNames} onClose={() => setCreating(false)} />}
      {editing && <UserFormModal user={editing} roleNames={roleNames} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${displayName(deleting.username)}?`}
          confirmLabel="Delete user"
          loading={remove.isPending}
          error={remove.error ? errorMessage(remove.error) : null}
          onConfirm={() => remove.mutate(deleting)}
          onClose={() => {
            remove.reset()
            setDeleting(null)
          }}
        >
          Their account and every review they wrote will be removed, which can change college ratings. It cannot be undone.
        </ConfirmDialog>
      )}
    </>
  )
}
