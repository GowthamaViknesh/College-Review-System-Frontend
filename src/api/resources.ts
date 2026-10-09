import { request } from '../lib/api'
import type { ActionLog, College, Me, Permission, Review, Role, StatsOverview, User } from '../lib/types'

// One function per API endpoint, grouped by resource

// A picture is sent as a form with one field, which is what the upload endpoints expect
function pictureForm(file: File) {
  const form = new FormData()
  form.append('image', file)
  return form
}

export interface Credentials {
  email: string
  password: string
}

export const authApi = {
  login: (body: Credentials) => request<{ user: User; token: string }>('/auth/login', { method: 'POST', body }),
  register: (body: Credentials & { username: string }) => request<{ user: User; token: string }>('/auth/register', { method: 'POST', body }),
  me: () => request<Me>('/auth/me'),
  updateProfile: (body: { username?: string; email?: string }) => request<{ user: User }>('/auth/me', { method: 'PATCH', body }),
  changePassword: (body: { currentPassword: string; newPassword: string }) => request<void>('/auth/me/password', { method: 'PATCH', body }),
  uploadAvatar: (file: File) => request<{ user: User }>('/auth/me/avatar', { method: 'PUT', body: pictureForm(file) }),
  removeAvatar: () => request<{ user: User }>('/auth/me/avatar', { method: 'DELETE' }),
}

export type CollegeSort = 'newest' | 'name' | 'rating' | 'reviews'
export type SortOrder = 'asc' | 'desc'

export interface CollegeQuery {
  page?: number
  limit?: number
  search?: string
  minRating?: number | ''
  sort?: CollegeSort
  order?: SortOrder
}

export interface CollegeInput {
  name: string
  city: string
  state: string
  description: string
}

export const collegesApi = {
  list: (query: CollegeQuery) => request<{ colleges: College[] }>('/colleges', { query: { ...query } }),
  get: (id: string) => request<{ college: College }>(`/colleges/${id}`),
  create: (body: CollegeInput) => request<{ college: College }>('/colleges', { method: 'POST', body }),
  update: (id: string, body: Partial<CollegeInput>) => request<{ college: College }>(`/colleges/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => request<void>(`/colleges/${id}`, { method: 'DELETE' }),
  uploadImage: (id: string, file: File) => request<{ college: College }>(`/colleges/${id}/image`, { method: 'PUT', body: pictureForm(file) }),
  removeImage: (id: string) => request<{ college: College }>(`/colleges/${id}/image`, { method: 'DELETE' }),
}

export type ReviewSort = 'newest' | 'oldest' | 'highest' | 'lowest'

export interface ReviewQuery {
  page?: number
  limit?: number
  college?: string
  user?: string
  sort?: ReviewSort
}

export interface ReviewInput {
  rating: number
  comment: string
}

export const reviewsApi = {
  list: (query: ReviewQuery) => request<{ reviews: Review[] }>('/reviews', { query: { ...query } }),
  create: (body: ReviewInput & { college: string }) => request<{ review: Review }>('/reviews', { method: 'POST', body }),
  update: (id: string, body: Partial<ReviewInput>) => request<{ review: Review }>(`/reviews/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => request<void>(`/reviews/${id}`, { method: 'DELETE' }),
}

export interface UserQuery {
  page?: number
  limit?: number
  search?: string
  role?: string
}

export interface CreateUserInput {
  username: string
  email: string
  password: string
  role?: string
}

export const usersApi = {
  list: (query: UserQuery) => request<{ users: User[] }>('/users', { query: { ...query } }),
  create: (body: CreateUserInput) => request<{ user: User }>('/users', { method: 'POST', body }),
  setRole: (id: string, role: string) => request<{ user: User }>(`/users/${id}/role`, { method: 'PATCH', body: { role } }),
  remove: (id: string) => request<void>(`/users/${id}`, { method: 'DELETE' }),
}

export interface RoleInput {
  name: string
  description: string
  permissions: string[]
}

export const rolesApi = {
  list: () => request<{ roles: Role[] }>('/roles'),
  permissions: () => request<{ permissions: Permission[] }>('/permissions'),
  create: (body: RoleInput) => request<{ role: Role }>('/roles', { method: 'POST', body }),
  update: (id: string, body: Partial<RoleInput>) => request<{ role: Role }>(`/roles/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => request<void>(`/roles/${id}`, { method: 'DELETE' }),
}

export interface LogQuery {
  page?: number
  limit?: number
  action?: string
  outcome?: string
  targetType?: string
}

export const logsApi = {
  list: (query: LogQuery) => request<{ logs: ActionLog[] }>('/action-logs', { query: { ...query } }),
}

export const statsApi = {
  overview: () => request<StatsOverview>('/stats/overview'),
}
