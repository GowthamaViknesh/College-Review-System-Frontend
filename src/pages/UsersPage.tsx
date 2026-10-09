import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { rolesApi, usersApi } from '../api/resources'
import { useAuth } from '../auth/AuthContext'
import { PageHeader } from '../components/Layout'
import { useToast } from '../components/Toast'
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorNote, Field, Input, Modal, Pagination, Select, Spinner } from '../components/ui'
import { errorMessage } from '../lib/api'
import { displayName, formatDate, plural } from '../lib/format'
import { applyServerErrors } from '../lib/forms'
import type { User } from '../lib/types'

const PAGE_SIZE = 8
// The role the API gives to accounts when none is chosen, and the only one a non-admin may hand out
const DEFAULT_ROLE = 'student'

const createUserSchema = z.object({
  username: z.string().trim().min(3, 'At least 3 characters').max(30, 'At most 30 characters'),
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'At least 8 characters').max(72, 'At most 72 characters'),
  role: z.string(),
})

type CreateUserValues = z.infer<typeof createUserSchema>

function CreateUserModal({ roleNames, onClose }: { roleNames: string[]; onClose: () => void }) {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<CreateUserValues>({ resolver: zodResolver(createUserSchema), defaultValues: { username: '', email: '', password: '', role: DEFAULT_ROLE } })
  const errors = form.formState.errors

  // Choosing a role other than the default needs role:assign; without it the API would refuse
  const canChooseRole = can('role:assign') && roleNames.length > 0

  const mutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(`Account created for ${displayName(data.user.username)}`)
      onClose()
    },
    onError: (error) => setFormError(applyServerErrors(error, form.setError, ['username', 'email', 'password', 'role'])),
  })

  return (
    <Modal title="Create a user" onClose={onClose}>
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          setFormError(null)
          mutation.mutate(values)
        })}
      >
        {formError && <ErrorNote>{formError}</ErrorNote>}
        <Field label="Username" error={errors.username?.message}>
          {({ id, describedBy }) => <Input id={id} autoComplete="off" aria-describedby={describedBy} aria-invalid={Boolean(errors.username)} {...form.register('username')} />}
        </Field>
        <Field label="Email" error={errors.email?.message}>
          {({ id, describedBy }) => <Input id={id} type="email" autoComplete="off" aria-describedby={describedBy} aria-invalid={Boolean(errors.email)} {...form.register('email')} />}
        </Field>
        <Field label="Password" error={errors.password?.message} hint="At least 8 characters. Share it with the person; they log in with it.">
          {({ id, describedBy }) => (
            <Input id={id} type="password" autoComplete="new-password" aria-describedby={describedBy} aria-invalid={Boolean(errors.password)} {...form.register('password')} />
          )}
        </Field>
        {canChooseRole ? (
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
          <p className="rounded-xl bg-panel px-4 py-3 text-sm text-zinc-600">
            The account will have the <strong className="text-ink">{DEFAULT_ROLE}</strong> role. Only someone who can assign roles can choose a different one.
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Create user
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

  const canRead = can('user:read')
  const canAssign = can('role:assign')

  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
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
    queryKey: ['users', { search, role, page }],
    queryFn: () => usersApi.list({ search, role, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled: canRead,
  })

  const setUserRole = useMutation({
    mutationFn: ({ user, roleName }: { user: User; roleName: string }) => usersApi.setRole(user._id, roleName),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(`${displayName(data.user.username)} is now ${data.user.role?.name}`)
    },
    onError: (error) => toast.error(error),
  })

  const remove = useMutation({
    mutationFn: (user: User) => usersApi.remove(user._id),
    onSuccess: (_result, user) => {
      // Their reviews go with them, which changes college averages
      queryClient.invalidateQueries()
      toast.success(`${displayName(user.username)} deleted`)
      setDeleting(null)
    },
  })

  const list = users.data?.data.users ?? []
  const total = users.data?.meta?.total

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={canRead && total !== undefined ? plural(total, 'account') : 'Create accounts for other people'}
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
          <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
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
          </div>

          {users.isPending ? (
            <Spinner label="Loading users" />
          ) : users.isError ? (
            <ErrorNote>{errorMessage(users.error)}</ErrorNote>
          ) : list.length === 0 ? (
            <EmptyState title="No users match">Try a different search or role.</EmptyState>
          ) : (
            <>
              <Card className={`relative overflow-x-auto p-2 transition-opacity ${users.isPlaceholderData ? 'opacity-60' : ''}`}>
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead>
                    <tr className="text-xs text-zinc-500">
                      <th scope="col" className="px-4 py-3 font-semibold">
                        User
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Role
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Joined
                      </th>
                      <th scope="col" className="px-4 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((user) => {
                      const isMe = user._id === me?._id
                      return (
                        <tr key={user._id} className="border-t border-zinc-200/80">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={user.username} src={user.avatar} />
                              <div className="min-w-0">
                                <p className="truncate font-semibold">
                                  {displayName(user.username)}
                                  {isMe && <span className="ml-2 text-xs font-medium text-zinc-500">(you)</span>}
                                </p>
                                <p className="truncate text-xs text-zinc-500">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {/* You cannot change your own role, so an admin can never demote themselves by accident */}
                            {canAssign && !isMe && roleNames.length > 0 ? (
                              <Select
                                value={user.role?.name ?? ''}
                                onChange={(event) => setUserRole.mutate({ user, roleName: event.target.value })}
                                disabled={setUserRole.isPending}
                                aria-label={`Role of ${displayName(user.username)}`}
                                className="!h-9 !w-36 capitalize"
                              >
                                {!user.role && <option value="">No role</option>}
                                {roleNames.map((name) => (
                                  <option key={name} value={name}>
                                    {name}
                                  </option>
                                ))}
                              </Select>
                            ) : (
                              <Badge tone={user.role?.name === 'admin' ? 'dark' : 'neutral'}>
                                <span className="capitalize">{user.role?.name ?? 'No role'}</span>
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{formatDate(user.createdAt)}</td>
                          <td className="px-4 py-3 text-right">
                            {can('user:delete') && !isMe && (
                              <Button variant="ghost" size="icon" onClick={() => setDeleting(user)} aria-label={`Delete ${displayName(user.username)}`}>
                                <Trash2 className="size-4" aria-hidden />
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
              <Pagination meta={users.data?.meta} onPage={setPage} />
            </>
          )}
        </>
      )}

      {creating && <CreateUserModal roleNames={roleNames} onClose={() => setCreating(false)} />}
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
