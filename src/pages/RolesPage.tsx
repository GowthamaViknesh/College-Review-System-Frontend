import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { rolesApi } from '../api/resources'
import { useAuth } from '../auth/AuthContext'
import { PageHeader } from '../components/Layout'
import { useToast } from '../components/Toast'
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorNote, Field, Input, Modal, Spinner } from '../components/ui'
import { errorMessage } from '../lib/api'
import { plural } from '../lib/format'
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

function RoleFormModal({ role, permissions, onClose }: { role?: Role; permissions: Permission[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
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
    <Modal title={role ? `Edit ${role.name}` : 'Create a role'} onClose={onClose} wide>
      <form
        noValidate
        className="space-y-5"
        onSubmit={form.handleSubmit((values) => {
          setFormError(null)
          mutation.mutate(values)
        })}
      >
        {formError && <ErrorNote>{formError}</ErrorNote>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors.name?.message} hint="For example: moderator">
            {({ id, describedBy }) => <Input id={id} autoComplete="off" aria-describedby={describedBy} aria-invalid={Boolean(errors.name)} {...form.register('name')} />}
          </Field>
          <Field label="Description" error={errors.description?.message} hint="Optional">
            {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} aria-invalid={Boolean(errors.description)} {...form.register('description')} />}
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1 text-sm font-semibold">
            Permissions <span className="font-normal text-zinc-500">({chosen.length} selected)</span>
          </legend>
          {errors.permissions && <p className="mb-2 text-xs font-medium text-red-600">{errors.permissions.message}</p>}
          <div className="max-h-[42vh] space-y-4 overflow-y-auto rounded-2xl bg-panel p-4">
            {[...groups].map(([resource, items]) => (
              <div key={resource}>
                <p className="mb-1.5 font-display text-sm font-medium capitalize">{resource}</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {items.map((permission) => (
                    <label key={permission.name} className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-white p-3 ring-1 ring-zinc-200 has-checked:ring-2 has-checked:ring-ink">
                      <input type="checkbox" value={permission.name} className="mt-0.5 size-4 shrink-0 accent-ink" {...form.register('permissions')} />
                      <span className="min-w-0">
                        <span className="block font-mono text-xs font-semibold">{permission.name}</span>
                        <span className="block text-xs text-zinc-500">{permission.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {role ? 'Save changes' : 'Create role'}
          </Button>
        </div>
      </form>
    </Modal>
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

  return (
    <>
      <PageHeader
        title="Roles"
        subtitle="A role is a named set of permissions. Changes apply on each user's next request."
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
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {roles.data.map((role) => {
            const locked = role.name === LOCKED_ROLE
            return (
              <li key={role._id}>
                <Card className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-xl leading-tight font-medium capitalize">{role.name}</h2>
                      <p className="mt-0.5 text-sm text-zinc-600">{role.description || 'No description'}</p>
                    </div>
                    {locked ? (
                      <Badge tone="dark">
                        <Lock className="size-3" aria-hidden />
                        Locked
                      </Badge>
                    ) : (
                      <div className="flex shrink-0 gap-1">
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
                      </div>
                    )}
                  </div>

                  <p className="mt-4 mb-2 text-xs font-semibold text-zinc-500">{plural(role.permissions.length, 'permission')}</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {role.permissions.map((permission) => (
                      <li key={permission} className="rounded-lg bg-white px-2 py-1 font-mono text-[11px] font-medium ring-1 ring-zinc-200">
                        {permission}
                      </li>
                    ))}
                    {role.permissions.length === 0 && <li className="text-sm text-zinc-500">This role cannot do anything yet.</li>}
                  </ul>
                  {locked && <p className="mt-auto pt-4 text-xs text-zinc-500">Always has every permission, so administrators can never be locked out.</p>}
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {editing && permissions.data && <RoleFormModal role={editing === 'new' ? undefined : editing} permissions={permissions.data} onClose={() => setEditing(null)} />}
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
