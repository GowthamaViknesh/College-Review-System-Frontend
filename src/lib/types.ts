// Shapes of what the API returns

export interface Meta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface FieldError {
  field: string
  message: string
}

export interface RoleRef {
  _id: string
  name: string
}

export interface User {
  _id: string
  username: string
  email: string
  role: RoleRef | null
  createdAt: string
}

export interface Me {
  user: User
  permissions: string[]
}

export interface Role {
  _id: string
  name: string
  description: string
  permissions: string[]
  createdAt: string
  updatedAt: string
}

export interface Permission {
  name: string
  resource: string
  description: string
}

export interface College {
  _id: string
  name: string
  city: string
  state: string
  description: string
  // null until the college has at least one review
  averageRating: number | null
  reviewCount: number
  createdAt: string
}

export interface Review {
  _id: string
  college: { _id: string; name: string } | null
  user: { _id: string; username: string } | null
  rating: number
  comment: string
  createdAt: string
  updatedAt: string
}

export type Outcome = 'success' | 'denied' | 'failed'

export interface ActionLog {
  _id: string
  actor: { id: string | null; username: string | null }
  action: string
  outcome: Outcome
  target: { type: string | null; id: string | null }
  details: Record<string, unknown>
  ip: string | null
  method: string
  path: string
  statusCode: number
  createdAt: string
}

export interface StatsOverview {
  totals: { colleges: number; reviews: number; averageRating: number | null; myReviews: number }
  reviewsPerDay: { date: string; count: number }[]
  ratingDistribution: { rating: number; count: number }[]
}
