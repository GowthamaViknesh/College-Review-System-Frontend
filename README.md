# College Reviews — Frontend

The web app for the College Review System API in `../Backend`. Built with Vite, React, TypeScript and Tailwind CSS.

## Run it

The backend must be running first (see `../Backend`), and seeded so there is an account to log in with.

```bash
npm install
cp .env.example .env    # only needed if the backend is not on http://localhost:5000
npm run dev             # http://localhost:5173
```

Log in with the seeded admin, `admin@example.com` / `Password@123`. While running `npm run dev`, the login page also has one-click **Admin** and **Student** buttons for these seeded accounts; they are left out of production builds. After `npm run seed:demo` in the backend there are also student accounts such as `arun@example.com` with the same password.

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the built app locally |
| `npm run lint` | Lint with oxlint |

## How it talks to the backend

The browser only ever calls the Vite dev server. Requests to `/api` are forwarded to the backend (`VITE_API_TARGET`, default `http://localhost:5000`), so no CORS setup is needed in development.

In production, serve `dist/` and the API from the same origin (for example behind one reverse proxy that sends `/api` to the backend), or set the backend's `CORS_ORIGIN` to the frontend's address.

## Pages and who sees them

What a user sees depends on the permissions their role grants, which the app reads from `GET /auth/me` after login. It never checks role names, so a custom role created by an admin works with no frontend change.

| Page | Path | Needs |
|---|---|---|
| Log in, Register | `/login`, `/register` | Nothing |
| Dashboard | `/` | Logged in |
| Colleges (search, filter, sort) | `/colleges` | Logged in. Add: `college:create`. Edit: `college:update`. Delete: `college:delete`. |
| College and its reviews | `/colleges/:id` | Logged in. Write a review: `review:create`, once per college. |
| My reviews | `/my-reviews` | `review:create` |
| Users | `/users` | `user:read` to list, `user:create` to add, `role:assign` to change a role, `user:delete` to delete |
| Roles | `/roles` | `role:read`; `role:create`, `role:update`, `role:delete` for the buttons |
| Action logs | `/logs` | `log:read` |

Hiding a button is a convenience, not security: the API enforces every one of these rules itself.

## Project layout

```
src/
  api/resources.ts     one function per API endpoint, grouped by resource
  auth/AuthContext.tsx  the logged-in user, their permissions, login and logout
  components/
    ui.tsx             buttons, cards, form fields, modal, stars, rating ring, pagination
    Layout.tsx         sidebar, page header, the permission guard
    colleges.tsx       college row and the add/edit form
    reviews.tsx        review card and the write/edit form
    Toast.tsx          brief confirmation and error messages
  lib/
    api.ts             fetch wrapper: adds the token, turns error responses into ApiError
    forms.ts           puts the API's per-field validation errors under the right inputs
    types.ts           shapes of what the API returns
    format.ts          dates, ratings, plurals
  pages/               one file per page
```

## Decisions worth knowing

- **Server data** is fetched and cached with TanStack Query. After a change (a new review, a deleted college) the affected lists are refetched, so averages and counts on screen are never stale.
- **Forms** use React Hook Form with Zod schemas that mirror the API's rules, so most mistakes are caught before a request is sent. Errors the API does return are shown under the field they belong to.
- **The token** is kept in `localStorage`. If the API rejects it (expired, or the account was deleted) the app logs out and returns to the login page.
- **Filters on the Colleges page live in the URL**, so a search can be bookmarked or shared and survives a refresh.
- **Pages are loaded on demand**, so the chart library is only downloaded by people who reach the dashboard.
