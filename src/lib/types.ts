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
  roleId: string
  name: string
}

export interface User {
  userId: string
  username: string
  email: string
  role: RoleRef | null
  // The college they belong to. Every teacher and student has one; administrators do not.
  college: { collegeId: string; name: string } | null
  // Address of the profile picture; null if they have not uploaded one
  avatar: string | null
  // When they last logged in or used the site, to about a minute; null if they never have
  lastActiveAt: string | null
  createdAt: string
}

export interface Me {
  user: User
  permissions: string[]
}

export interface Role {
  roleId: string
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
  collegeId: string
  name: string
  // Where it is, as names: "India", "Tamil Nadu", "Chennai". The address is the street-level part and may be empty.
  country: string
  state: string
  city: string
  address: string
  description: string
  // Address of the college's picture; null if nobody has uploaded one
  image: string | null
  // null until the college has at least one review
  averageRating: number | null
  reviewCount: number
  createdAt: string
}

export interface Review {
  reviewId: string
  college: { collegeId: string; name: string } | null
  user: { userId: string; username: string; avatar: string | null } | null
  rating: number
  comment: string
  createdAt: string
  updatedAt: string
}

export type Outcome = 'success' | 'denied' | 'failed'

export interface ActionLog {
  logId: string
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
