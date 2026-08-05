# Lost & Found Matching Platform

A full-stack MERN application that lets users report lost and found items.
Whenever a **found item** is submitted, the backend automatically compares it
against every open **lost item** report and calculates a match score using a
simple, transparent weighted algorithm (no AI/ML involved).

---

## Tech Stack

| Layer          | Technology                     |
|----------------|---------------------------------|
| Frontend       | React (Vite) + React Router     |
| Backend        | Node.js + Express.js            |
| Database       | MongoDB + Mongoose              |
| Authentication | JWT + bcrypt                    |
| File Uploads   | Multer (stored locally)         |
| Styling        | Plain CSS                       |

---

## Access Control (Role-Based)

Two roles exist: `user` (default on registration) and `admin`. There is no
public "register as admin" flow — admin accounts are provisioned with the
`create-admin` script (see below).

- **Public**: Home page, Login, Register only. A signed-out visitor cannot
  see the Dashboard, item lists, report forms, matches, profile, or admin
  panel.
- **Private / User** (requires login): Dashboard, Report Lost/Found Item,
  Lost Items List, Found Items List, Match Results, My Matches, Profile.
  Gated by the `PrivateRoute` component on the frontend and the `protect`
  JWT middleware on the backend.
- **Private / Admin** (requires login + `role: "admin"`): Admin Dashboard
  at `/admin` — platform stats, all users, all lost/found items, all
  matches with verify/return actions, and delete controls for inappropriate
  reports. Gated by `AdminRoute` on the frontend and `protect` + `isAdmin`
  middleware (in that order) on the backend. Non-admins hitting `/admin`
  are redirected to `/dashboard` rather than `/login`, since they're
  authenticated — just not authorized for that page.

### Creating the first admin account

```bash
cd backend
npm run create-admin -- "Admin Name" admin@example.com "StrongPassword123"
```

Running this against an email that already has a regular account promotes
it to admin instead of creating a duplicate.

---

## Project Structure

```text
lost-and-found-platform/
│
├── backend/
│   ├── controllers/     # Request handlers (business logic entry points)
│   ├── middleware/      # auth, error handling, file upload, validation
│   ├── models/          # Mongoose schemas: User, LostItem, FoundItem
│   ├── routes/          # Express route definitions
│   ├── services/        # matchingService.js — the scoring algorithm
│   ├── uploads/          # Uploaded images are stored here
│   ├── config/           # Database connection setup
│   ├── utils/             # asyncHandler, ApiError, apiResponse helpers
│   ├── app.js             # Express app setup (middleware + routes)
│   ├── server.js           # Entry point — connects DB and starts server
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/    # Navbar, ItemCard, MatchBadge, Loader, PrivateRoute
    │   ├── pages/           # Home, Login, Register, Dashboard, report forms,
    │   │                       item lists, MatchResults, Profile
    │   ├── services/         # Axios instance + one service file per resource
    │   ├── context/           # AuthContext (login/register/logout state)
    │   ├── hooks/               # useAuth
    │   ├── App.jsx               # Route definitions
    │   └── main.jsx
    └── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A running MongoDB instance (local or MongoDB Atlas)

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env and set your MONGO_URI and JWT_SECRET
npm run dev
```

The API will run at `http://localhost:5000`.

### 2. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env if your backend runs on a different URL
npm run dev
```

The app will run at `http://localhost:5173`.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable         | Description                                  | Example                                    |
|-------------------|-----------------------------------------------|---------------------------------------------|
| `PORT`             | Port the Express server listens on            | `5000`                                       |
| `MONGO_URI`        | MongoDB connection string                     | `mongodb://127.0.0.1:27017/lost-and-found`  |
| `JWT_SECRET`       | Secret used to sign JWTs                       | a long random string                        |
| `JWT_EXPIRES_IN`   | How long tokens stay valid                     | `7d`                                         |
| `CLIENT_URL`       | Frontend origin, used for CORS                  | `http://localhost:5173`                     |

### Frontend (`frontend/.env`)

| Variable              | Description                | Example                          |
|------------------------|------------------------------|------------------------------------|
| `VITE_API_BASE_URL`     | Base URL of the backend API   | `http://localhost:5000/api`       |

---

## API Documentation

All responses follow this shape:

```json
{
  "success": true,
  "message": "Descriptive message",
  "data": {}
}
```

### Auth

| Method | Route               | Access  | Description             |
|--------|----------------------|---------|--------------------------|
| POST   | `/api/auth/register`  | Public  | Create a new account      |
| POST   | `/api/auth/login`      | Public  | Log in, returns a JWT       |
| GET    | `/api/auth/me`          | Private | Get the logged-in user's profile |

### Lost Items

| Method | Route               | Access  | Description                     |
|--------|----------------------|---------|-----------------------------------|
| POST   | `/api/lost`            | Private | Create a lost item report (multipart/form-data, field `image` optional) |
| GET    | `/api/lost`             | Private | List lost items — supports `search`, `category`, `location`, `page`, `limit` query params |
| GET    | `/api/lost/:id`          | Private | Get one lost item                 |
| PUT    | `/api/lost/:id`           | Private | Update a lost item (owner only)     |
| DELETE | `/api/lost/:id`            | Private | Delete a lost item (owner only)       |

### Found Items

| Method | Route                | Access  | Description                                                          |
|--------|------------------------|---------|------------------------------------------------------------------------|
| POST   | `/api/found`             | Private | Create a found item report. The response includes a `matches` array comparing it against every open lost item. |
| GET    | `/api/found`              | Private | List found items — supports the same query params as lost items       |
| GET    | `/api/found/:id`           | Private | Get one found item                                                     |
| PUT    | `/api/found/:id`            | Private | Update a found item (owner only)                                        |
| DELETE | `/api/found/:id`             | Private | Delete a found item (owner only)                                          |

### Matches

| Method | Route                     | Access  | Description                                          |
|--------|-----------------------------|---------|---------------------------------------------------------|
| GET    | `/api/matches`                | Private | Persisted matches (score >= 60) for every found item, grouped by found item |
| GET    | `/api/matches/:foundItemId`     | Private | Persisted matches for one specific found item                |

Matches are calculated once, when a found item is created, and persisted to
their own `Match` collection (rather than recalculated on every request).
This is what lets an admin verify a match and mark it returned without that
state getting lost.

### My Reports & Matches (User)

| Method | Route              | Access  | Description                                  |
|--------|----------------------|---------|-------------------------------------------------|
| GET    | `/api/my/lost`         | Private | Lost items reported by the logged-in user         |
| GET    | `/api/my/found`         | Private | Found items reported by the logged-in user          |
| GET    | `/api/my/matches`        | Private | Matches involving any of the user's own reports       |
| PUT    | `/api/auth/me`             | Private | Update the logged-in user's own name                    |

### Admin

| Method | Route                          | Access | Description                                              |
|--------|----------------------------------|--------|-------------------------------------------------------------|
| GET    | `/api/admin/stats`                 | Admin  | Platform-wide statistics                                     |
| GET    | `/api/admin/users`                   | Admin  | List every registered user                                     |
| GET    | `/api/admin/lost`                      | Admin  | List every lost item report                                      |
| GET    | `/api/admin/found`                       | Admin  | List every found item report                                       |
| GET    | `/api/admin/matches`                       | Admin  | List every match record                                               |
| PUT    | `/api/admin/match/:id/verify`                | Admin  | Mark a match as verified (confirms it's really the same item)          |
| PUT    | `/api/admin/match/:id/reject`                  | Admin  | Reject a match as a false positive — hides it from both users            |
| PUT    | `/api/admin/match/:id/returned`                | Admin  | Mark a verified match as returned (also resolves the underlying reports) |
| DELETE | `/api/admin/lost/:id`                            | Admin  | Delete an inappropriate/spam lost item report                            |
| DELETE | `/api/admin/found/:id`                             | Admin  | Delete an inappropriate/spam found item report                             |

**Verify → Returned workflow:** a match cannot be marked `returned` until it
has first been marked `verified`. This mirrors how a real lost-and-found
office works — the algorithm's high score is a lead, not a guarantee, so a
human confirms it before the item is handed back. Rejecting a match (a
false positive) hides it from both users' match lists but keeps the record
for admin audit; rejected matches cannot be returned, and verifying a
match clears any earlier rejection.

**Why the match happened, not just the score:** every `Match` document
stores `matchedFields` — the specific fields (category, item name,
location, color, brand) that contributed to the score. Both the admin
detail view and the user-facing match pages render this as a ✔ / ✘
checklist, so nobody has to just trust a percentage.

---

## The Matching Algorithm

Located in `backend/services/matchingService.js`. It compares a found item to
a lost item field-by-field and adds up points using plain `if` statements —
no AI or machine learning:

```text
+30  if category matches
+25  if item name matches
+20  if location matches
+15  if color matches
+10  if brand matches
```

| Score Range | Classification    |
|-------------|--------------------|
| 80 - 100    | High Match          |
| 60 - 79     | Possible Match        |
| Below 60    | No Match                |

A match result looks like:

```json
{
  "score": 85,
  "status": "High Match"
}
```

---

## Notes for Interviews / Learning

- Business logic is separated from routes: **routes → controllers →
  services/models**.
- Passwords are hashed with bcrypt before being saved; the password field is
  never returned in API responses.
- JWTs are verified in `middleware/auth.js` and attach the current user to
  `req.user`.
- Every controller is wrapped in `asyncHandler` so errors are forwarded to a
  single, central `errorHandler` middleware instead of repeating try/catch
  blocks everywhere.
- The frontend keeps auth state in a React Context (`AuthContext`) backed by
  `localStorage`, and a `PrivateRoute` component gates every page that
  requires a logged-in user.
