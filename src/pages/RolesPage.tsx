import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { rolesApi } from '../api/resources'
import { useAuth } from '../auth/AuthContext'
import { PageHeader } from '../components/Layout'
import { useToast } from '../components/Toast'
import { Badge, Button, Card, ConfirmDialog, Drawer, EmptyState, ErrorNote, Field, Input, Spinner } from '../components/ui'
import { errorMessage } from '../lib/api'
import { formatDate, plural } from '../lib/format'
import { applyServerErrors } from '../lib/forms'
import type { Permission, Role } from '../lib/types'

// The one role the API never lets anyone change or delete
const LOCKED_ROLE = 'admin'

const roleSchema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9_-]{1,29}$/, '2–30 characters: lowercase letters, numbers, "-" or "_", starting with a letter'),
  description: z.string().trim().max(200, 'At most 200 characters'),
  permissions: z.array(z.string()),
})

type RoleValues = z.infer<typeof roleSchema>

// Creates a role, or edits the one passed in, in a panel that slides in from the right
function RoleDrawer({ role, permissions, onClose }: { role?: Role; permissions: Permission[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const formId = useId()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<RoleValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: role?.name ?? '', description: role?.description ?? '', permissions: role?.permissions ?? [] },
  })
  const errors = form.formState.errors
  const chosen = form.watch('permissions')

  // Group the catalogue by what each permission is about: user, role, college, review, log
  const groups = new Map<string, Permission[]>()
  for (const permission of permissions) groups.set(permission.resource, [...(groups.get(permission.resource) ?? []), permission])

  // Tick or untick every permission in one group
  function toggleGroup(items: Permission[], select: boolean) {
    const names = items.map((item) => item.name)
    const rest = chosen.filter((name) => !names.includes(name))
    form.setValue('permissions', select ? [...rest, ...names] : rest, { shouldDirty: true })
  }

  const mutation = useMutation({
    mutationFn: (values: RoleValues) => (role ? rolesApi.update(role._id, values) : rolesApi.create(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      // If it is the role of the person editing, what they may do has just changed
      queryClient.invalidateQueries({ queryKey: ['me'] })
      toast.success(role ? 'Role updated' : 'Role created')
      onClose()
    },
    onError: (error) => {
      const message = applyServerErrors(error, form.setError, ['name', 'description', 'permissions'])
      // Role "x" already exists
      if (message?.includes('already exists')) form.setError('name', { message })
      else setFormError(message)
    },
  })

  return (
    <Drawer
      title={role ? `Edit ${role.name}` : 'Create a role'}
      subtitle={role ? 'Changes apply to everyone with this role on their next request.' : 'Name the role, then choose what people with it may do.'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={mutation.isPending}>
            {role ? 'Save changes' : 'Create role'}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="space-y-6"
        onSubmit={form.handleSubmit((values) => {
          setFormError(null)
          mutation.mutate(values)
        })}
      >
        {formError && <ErrorNote>{formError}</ErrorNote>}
        <Field label="Name" error={errors.name?.message} hint="For example: moderator">
          {({ id, describedBy }) => <Input id={id} autoComplete="off" aria-describedby={describedBy} aria-invalid={Boolean(errors.name)} {...form.register('name')} />}
        </Field>
        <Field label="Description" error={errors.description?.message} hint="Optional. Shown in the roles list.">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} aria-invalid={Boolean(errors.description)} {...form.register('description')} />}
        </Field>

        <fieldset>
          <legend className="text-sm font-semibold">
            Permissions{' '}
            <span className="font-normal text-zinc-500">
              ({chosen.length} of {permissions.length} selected)
            </span>
          </legend>
          {errors.permissions && <p className="mt-1 text-xs font-medium text-red-600">{errors.permissions.message}</p>}

          <div className="mt-3 space-y-5">
            {[...groups].map(([resource, items]) => {
              const allChosen = items.every((item) => chosen.includes(item.name))
              return (
                <div key={resource}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium capitalize">{resource}</p>
                    <button type="button" onClick={() => toggleGroup(items, !allChosen)} className="cursor-pointer rounded-md text-xs font-medium text-zinc-600 underline underline-offset-4 hover:text-ink">
                      {allChosen ? 'Clear' : 'Select all'}
                      <span className="sr-only"> {resource} permissions</span>
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((permission) => (
                      <label key={permission.name} className="flex cursor-pointer items-start gap-3 rounded-xl bg-panel p-3 ring-1 ring-transparent has-checked:bg-white has-checked:ring-2 has-checked:ring-ink">
                        <input type="checkbox" value={permission.name} className="mt-0.5 size-4 shrink-0 accent-ink" {...form.register('permissions')} />
                        <span className="min-w-0">
                          <span className="block font-mono text-xs font-semibold">{permission.name}</span>
                          <span className="block text-xs text-zinc-600">{permission.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </fieldset>
      </form>
    </Drawer>
  )
}

export function RolesPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [editing, setEditing] = useState<Role | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Role | null>(null)

  const roles = useQuery({ queryKey: ['roles'], queryFn: () => rolesApi.list().then((result) => result.data.roles) })
  const permissions = useQuery({ queryKey: ['permissions'], queryFn: () => rolesApi.permissions().then((result) => result.data.permissions), staleTime: Infinity })

  const remove = useMutation({
    mutationFn: (role: Role) => rolesApi.remove(role._id),
    onSuccess: (_result, role) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success(`Role ${role.name} deleted`)
      setDeleting(null)
    },
  })

  const canChange = can('role:update') || can('role:delete')

  return (
    <>
      <PageHeader
        title="Roles"
        subtitle={roles.data ? `${plural(roles.data.length, 'role')}. Changes apply on each user's next request.` : 'A role is a named set of permissions.'}
        actions={
          can('role:create') && (
            <Button onClick={() => setEditing('new')} disabled={!permissions.data}>
              <Plus className="size-4" aria-hidden />
              Create role
            </Button>
          )
        }
      />

      {roles.isPending ? (
        <Spinner label="Loading roles" />
      ) : roles.isError ? (
        <ErrorNote>{errorMessage(roles.error)}</ErrorNote>
      ) : roles.data.length === 0 ? (
        <EmptyState title="No roles yet" />
      ) : (
        <Card className="relative overflow-x-auto p-2">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead>
              <tr className="text-xs text-zinc-500">
                <th scope="col" className="w-64 px-4 py-3 font-semibold">
                  Role
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Permissions
                </th>
                <th scope="col" className="w-32 px-4 py-3 font-semibold">
                  Last changed
                </th>
                {canChange && (
                  <th scope="col" className="w-28 px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {roles.data.map((role) => {
                const locked = role.name === LOCKED_ROLE
                return (
                  <tr key={role._id} className="border-t border-zinc-200/80 align-top">
                    <td className="px-4 py-4">
                      <p className="text-base leading-tight font-medium capitalize">{role.name}</p>
                      <p className="mt-0.5 text-xs text-zinc-600">{role.description || 'No description'}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="mb-2 text-xs font-semibold text-zinc-500">{plural(role.permissions.length, 'permission')}</p>
                      {role.permissions.length === 0 ? (
                        <p className="text-sm text-zinc-500">This role cannot do anything yet.</p>
                      ) : (
                        <ul className="flex flex-wrap gap-1.5">
                          {role.permissions.map((permission) => (
                            <li key={permission} className="rounded-lg bg-white px-2 py-1 font-mono text-[11px] font-medium ring-1 ring-zinc-200">
                              {permission}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-zinc-600">{formatDate(role.updatedAt)}</td>
                    {canChange && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {locked ? (
                          // The admin role always has every permission, so administrators can never be locked out
                          <span title="Always has every permission, so administrators can never be locked out.">
                            <Badge tone="dark">
                              <Lock className="size-3" aria-hidden />
                              Locked
                            </Badge>
                          </span>
                        ) : (
                          <>
                            {can('role:update') && (
                              <Button variant="ghost" size="icon" onClick={() => setEditing(role)} disabled={!permissions.data} aria-label={`Edit ${role.name}`}>
                                <Pencil className="size-4" aria-hidden />
                              </Button>
                            )}
                            {can('role:delete') && (
                              <Button variant="ghost" size="icon" onClick={() => setDeleting(role)} aria-label={`Delete ${role.name}`}>
                                <Trash2 className="size-4" aria-hidden />
                              </Button>
                            )}
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {editing && permissions.data && <RoleDrawer role={editing === 'new' ? undefined : editing} permissions={permissions.data} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title={`Delete the ${deleting.name} role?`}
          confirmLabel="Delete role"
          loading={remove.isPending}
          error={remove.error ? errorMessage(remove.error) : null}
          onConfirm={() => remove.mutate(deleting)}
          onClose={() => {
            remove.reset()
            setDeleting(null)
          }}
        >
          A role can only be deleted when no user has it. Move its users to another role first.
        </ConfirmDialog>
      )}
    </>
  )
}
