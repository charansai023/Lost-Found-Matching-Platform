# Lost & Found Matching Platform

A full-stack MERN application that helps campus students and staff reunite lost belongings with their owners. Users report lost and found items, an **AI-assisted matching engine** compares reports, and a structured **claim → verification → return → reward** workflow — supervised by administrators — completes the recovery.

**Live application:** https://lost-found-matching-platform-sv2h.vercel.app

---

## Overview

The platform is a campus Lost & Found system built on the MERN stack (MongoDB, Express, React, Node.js). Its major implemented capabilities:

- **Lost item reporting** — structured reports with item type, category, brand, color, model, description, location, date, unique marks, and an optional photo
- **Found item reporting** — same structured reporting for items found on campus
- **Search & filtering** — keyword search with synonym expansion, plus category/location filters and pagination
- **AI-assisted matching** — a hybrid engine combining Gemini Vision image analysis and semantic text embeddings, with a deterministic fallback
- **Claim workflow** — claimants submit identifying marks and ownership details; admins verify
- **Admin verification** — matches and claims are reviewed, verified, or rejected by admins
- **Return workflow** — admins confirm the physical handover before anything else happens
- **Finder rewards** — points awarded to the finder only after a confirmed return, with server-side double-award protection
- **Real-time in-app notifications** — Socket.IO delivery of match alerts, claim updates, and return confirmations
- **Analytics** — admin dashboard metrics computed server-side from source-of-truth collections
- **Cloudinary image storage** — persistent cloud media storage for uploaded item photos
- **Role-based access control** — `user` and `admin` roles, enforced server-side on every sensitive operation
- **Security & validation** — rate limiting, strict CORS, ObjectId validation, regex escaping, future-date rejection, and server-authoritative reward logic

---

## Key Features

### Authentication & Authorization

- JWT-based authentication with hashed passwords (`bcryptjs`).
- Two roles: `user` and `admin`. Registration always creates a `user` — the role is hardcoded server-side, so nobody can register (or self-promote) as an admin. Admin accounts are provisioned explicitly via seed scripts.
- Every item, claim, match, and reward route requires a valid JWT; admin routes additionally require the `admin` role (`protect` + `isAdmin` middleware).
- Owner-only edit/delete of reports; admins see extended private fields (unique marks, ownership details) that regular listings hide.
- Auth endpoints are rate-limited: **20 logins / 15 min** and **10 registrations / hour** per client.
- Registration can optionally be restricted to college email domains (`RESTRICT_EMAIL_DOMAIN`).

> Note: password reset via email is not part of the current intended feature set.

### Lost & Found Reporting

- Create, list, view, edit, and delete lost and found reports (edit/delete restricted to the report owner).
- Structured fields: item type, category, brand, color, model, description, location, date, unique identifying marks, and an optional image (JPEG/PNG/WebP, max 5 MB).
- Listings support keyword search (with synonym expansion, e.g. *mobile* ↔ *phone*), category and location filters, and pagination.
- **Date rule (business rule):** a report date may be **today or any previous date — future dates are rejected with `400 Bad Request`**. This is enforced server-side on both create and update for lost *and* found reports, using calendar-day semantics (no timezone-midnight edge cases). The frontend date pickers also cap selection at today, but the server rule is authoritative and cannot be bypassed.

### Self-Claim Protection

- A user **cannot claim a found item they reported themselves** — the backend rejects it with `403 Forbidden`, so the rule holds even if the frontend is bypassed.
- On return, if the owner and finder turn out to be the same user, the item is still returned but **no finder reward is awarded**.
- Owner-only and finder-only views/actions are enforced by server-side ownership checks (a late fix also corrected the visibility of actions for lost-item owners viewing their own reports).

### AI Matching Engine

Matching runs **asynchronously in the background** whenever an item is reported or updated (a non-blocking queue), so report creation stays fast. Each candidate lost/found pair is scored by a hybrid engine (matching version `v3`):

| Evidence | Weight | How it is computed |
| :--- | :---: | :--- |
| Image similarity | **60%** | Google Gemini Vision (`gemini-flash-latest`) compares both photos and returns a semantic object-similarity score |
| Title similarity | **15%** | Gemini text embeddings (`gemini-embedding-001`, 768-d) cosine similarity; token matching as fallback |
| Description similarity | **15%** | Same embedding pipeline on descriptions |
| Location similarity | **5%** | Same embedding pipeline on locations |
| Category compatibility | **5%** | Deterministic category/item-type compatibility matrix |

Key behaviors (all verified in `backend/services/matchingService.js`):

- **Final confidence is always the combined weighted score** — the UI never presents the image-only score as the overall match confidence.
- **No-image policy (identity substitution):** when a report has no image, the 60% image slot is filled with an identity score derived from item-type + category text overlap, **capped at 95** so a missing visual confirmation can never fabricate a perfect score. This principled substitution replaced the older arbitrary "85% ceiling" rule, allowing strong text evidence to still reach high confidence.
- **Deterministic fallback engine:** if Gemini is unavailable (no API key, or failures after retries), a local visual-statistics embedding (512-d) produces a conservative similarity score **capped at 60%** — byte statistics are never allowed to masquerade as semantic AI judgment.
- **Bounded retry with backoff:** Gemini calls retry up to 3 attempts (500 ms → 1,000 ms) on transient failures only (HTTP 429/500/502/503, timeouts). Permanent failures (bad key, bad request, malformed response) fail immediately with a recorded reason.
- **Category safeguards:** incompatible categories cap the score at 30%; known conflicting pairs (e.g. Wallet vs Phone/Laptop/Bottle → 20%, Keys vs Shoes/Laptop → 14%) are hard-capped.
- **Brand & color similarity** are computed for the admin breakdown view (informational only — not part of the weighted score).
- Matches are persisted at score ≥ 30 (or AI-flagged) with match levels: **High Match ≥ 70**, **Possible Match 40–69**, **Low Match < 40**.
- Every match stores a **human-readable explanation** and a per-run scoring log for transparency.

### AI Engine Transparency

Every Match record persists **which engine produced the image score** (`imageEngine`):

| Engine | Meaning |
| :--- | :--- |
| `Gemini` | Score produced by the Gemini Vision API |
| `Fallback` | Deterministic visual-statistics engine (Gemini unavailable; reason stored in `imageEngineReason`) |
| `Identical File` | Both reports reference the exact same image file |
| `None` | No image available — identity substituted from item-type/category metadata (reason recorded) |
| `Legacy` | Pre-existing records created before provenance tracking (no migration required) |

The frontend shows the **overall weighted confidence** as the headline match score (`MatchBadge`), while the `AiMatchAnalysis` panel breaks down each component and discloses the engine provenance — so a 90% score backed by Gemini reads differently from one backed by the fallback engine. Admin analytics also break match counts down by engine.

### Claims & Verification

Two supported claim paths, both producing the same lifecycle:

1. **Match-based claim** — the owner claims against a found item linked to their lost report (a Claim referencing both items).
2. **Direct claim** — a user who never filed a lost report can claim a found item directly (Claim without a linked lost item). Fully supported through verification and return.

Lifecycle:

```
pending  →  verified  →  returned
   ↘ rejected
```

- Claimants submit **unique identifying marks, ownership details, approximate date lost, and an optional proof image**.
- Duplicate active claims by the same user for the same item are rejected.
- Only `Pending`/`Matched` found items are claimable.
- **Verification ≠ return.** Admin *verification* confirms the claim looks legitimate; only the separate **mark-as-returned** action records that the physical handover actually happened. Rewards are tied to the return, never to verification.

### Finder Rewards

- The **finder** (the user who reported the found item) earns points **only after the item is actually returned** — the owner never receives the finder reward.
- Points per category come from an admin-configurable `RewardConfig` (default fallback: 50 points).
- Reward levels: Bronze Helper → Silver Helper (201) → Gold Helper (501) → Platinum Helper (1,001) → Campus Legend (2,001).
- Redemption is **server-authoritative**: the redeemable catalog (e.g. Printing Credits 100, Canteen Coupon 200, … College Merchandise 800) is defined in `rewardService.js`, and any client-supplied price is ignored — a forged request cannot buy rewards at a discount.
- **No double rewards, ever:** both return paths (Match return and Claim return) share one canonical award routine guarded by an atomic conditional update. The Match path flips an `isRewarded` flag; direct claims use an indexed `rewardGranted` flag on the Claim — so the same return can never pay twice, even under concurrent requests.
- A public **leaderboard** ranks finders by points.

### Notifications

- Fully **in-app** notifications (no email is sent anywhere in the current system).
- Delivered in real time over **Socket.IO** with JWT-authenticated handshakes; users join a personal room, admins join an `admins` room.
- Persisted in MongoDB, so the notification bell shows history even for events missed while offline.
- Cover: new reports, new claims, high-confidence AI matches, match verification/rejection, claim approval/rejection, and returns (owner, finder, and admin audiences).

### Analytics

The admin dashboard (`GET /api/admin/stats`) computes every metric server-side from its source-of-truth collection:

- Totals: users, lost reports, found reports, matches, claims
- Match pipeline: pending / verified / returned / high-confidence / AI-flagged counts, and **average match confidence** (aggregated across all matches in the database)
- Claim pipeline: pending / verified / rejected / returned counts
- **Recovery rate** = distinct lost items actually returned ÷ total lost items — counted from the `LostItem` collection itself, so one real-world recovery is never double-counted through both Claim and Match records
- **AI engine breakdown**: matches per image engine (Gemini / Fallback / Identical File / None / Legacy)

### Image Storage

- Uploads go to **Cloudinary** (via `multer-storage-cloudinary`, folder `lost-and-found`) — persistent cloud storage, not the backend's ephemeral local filesystem.
- Allowed formats: JPEG/JPG/PNG/WebP; 5 MB max per image.
- Images from before the Cloudinary migration (legacy `/uploads/...` paths on the old ephemeral disk) are **permanently unavailable**; the frontend `SafeImage` component detects them and renders a graceful "image unavailable" placeholder instead of a broken image.

### Security & Validation

Implemented protections (no exaggeration — each is in the code):

- **Server-side validation** on registration, login, and item fields
- **ObjectId validation** — malformed IDs return a clean `400` before any DB query; a global handler also converts Mongoose `CastError`s to `400`
- **Regex escaping** — all user input used in MongoDB `$regex` searches is escaped (prevents regex injection/crashes)
- **Future-date rejection** — calendar-day-accurate, on all four report create/update paths
- **Self-claim protection** — server-enforced `403`
- **Server-authoritative rewards** — catalog prices and awarding live on the server; atomic double-award guards
- **Rate limiting** — in-memory per-client sliding window on auth endpoints
- **Strict CORS** — a single shared origin policy (`config/corsOrigins.js`) for both Express and Socket.IO: exact production frontend + localhost development only; arbitrary `*.vercel.app` origins are rejected
- **Role hardcoding at registration** and `admin`-only route protection
- Secrets are supplied via environment variables and are never committed

---

## Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18 (`react@^18.3.1`), Vite 8 (`vite@^8.1.4`), React Router v6 (`react-router-dom@^6.24.0`), Axios (`axios@^1.7.2`), plain CSS |
| **Backend** | Node.js, Express 4 (`express@^4.19.2`) |
| **Database** | MongoDB with Mongoose 8 (`mongoose@^8.4.0`), hosted on MongoDB Atlas |
| **AI** | Google Gemini API over raw HTTPS — Vision via `gemini-flash-latest`, text embeddings via `gemini-embedding-001` (768-d output), with deterministic local fallbacks |
| **Real-time** | Socket.IO 4 (`socket.io@^4.8.3` / `socket.io-client@^4.8.3`) |
| **Images** | Cloudinary (`cloudinary@^1.41.3`, `multer-storage-cloudinary@^4.0.0`), Multer |
| **Auth & Security** | JWT (`jsonwebtoken@^9.0.2`), `bcryptjs@^2.4.3`, custom in-memory rate limiter |
| **Deployment** | Vercel (frontend), Render (backend) |
| **Testing** | Node's built-in test runner with custom assertion suites |

---

## System Architecture

```
┌──────────────┐
│     User     │  (student / staff / admin)
└──────┬───────┘
       ▼
┌──────────────────────────────┐
│  React Frontend (Vercel)     │  React 18 + React Router + Axios
└──────┬───────────────┬───────┘
       │ REST (JWT)    │ Socket.IO client (JWT handshake)
       ▼               ▼
┌──────────────────────────────┐
│  Express API (Render)        │  auth / lost / found / matches / claims /
│  + Socket.IO server          │  notifications / rewards / admin
└──────┬───────────────┬───────┘
       │ Mongoose      │ async matching queue (non-blocking)
       ▼               ▼
┌──────────────┐   ┌─────────────────────────────────────┐
│ MongoDB Atlas│   │  AI Matching Services               │
│  users, items│   │  ├─ Gemini Vision (image score)     │
│  matches,    │◄──┤  ├─ Gemini embeddings (768-d text)  │
│  claims,     │   │  ├─ category/location evidence      │
│  notifications│  │  └─ deterministic fallback engine   │
└──────────────┘   └─────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Cloudinary                  │  persistent item images
└──────────────────────────────┘
```

- **Notifications flow:** backend event → persisted in MongoDB → emitted via Socket.IO → `new_notification` event to the user's room (or the `admins` room).
- **Images flow:** frontend upload → Express/Multer → Cloudinary → Cloudinary URL stored on the item document.
- **Matching flow:** item created/updated → immediate lightweight attribute pre-match for instant feedback → background queue runs the full hybrid scoring (embeddings + image AI) → Matches persisted → notifications fired for high-confidence matches.

---

## Project Structure

```text
Lost-Found-Matching-Platform/
├── backend/
│   ├── config/               # db.js, cloudinary.js, corsOrigins.js (shared CORS policy)
│   ├── controllers/          # auth, lostItem, foundItem, match, my, claim,
│   │                         # notification, reward, admin, adminReward handlers
│   ├── middleware/           # auth (JWT + role), upload (Cloudinary/Multer),
│   │                         # validate (helpers + validators), rateLimiter, errorHandler
│   ├── models/               # User, LostItem, FoundItem, Match, Claim, Notification,
│   │                         # RewardConfig, RewardHistory, RedemptionRequest schemas
│   ├── routes/               # Express route definitions (one file per domain)
│   ├── scripts/              # createAdmin.js, seedAdmin.js, recalculateMatches.js
│   ├── services/             # matchingService.js (hybrid engine v3),
│   │                         # imageSimilarityService.js (Gemini Vision + fallback),
│   │                         # textEmbeddingService.js (Gemini 768-d embeddings),
│   │                         # asyncMatchingQueue.js, socketService.js, rewardService.js
│   ├── tests/                # 6 suites, 77 tests (see Testing)
│   ├── uploads/              # legacy local image dir (kept for path resolution)
│   ├── utils/                # ApiError, apiResponse envelope, asyncHandler
│   ├── app.js                # Express app: CORS, routes, error handling
│   ├── server.js             # HTTP server entry point + Socket.IO init
│   └── package.json
│
├── frontend/
│   ├── public/               # static assets
│   ├── src/
│   │   ├── components/       # Navbar, ItemCard, MatchBadge, AiMatchAnalysis, MatchReasons,
│   │   │                     # ClaimModal, IFoundThisItemModal, SafeImage, NotificationBell,
│   │   │                     # StatusBadge, CompleteProfile, PrivateRoute, AdminRoute, Loader
│   │   ├── context/          # AuthContext (JWT session + socket connection)
│   │   ├── hooks/            # useAuth
│   │   ├── pages/            # Home, Login, Register, ForgotPassword, Lost/FoundItemsList,
│   │   │                     # Lost/FoundItemDetail, ReportLostItem, ReportFoundItem,
│   │   │                     # MyReports, Profile, AdminDashboard,
│   │   │                     │   ├── Admin/Rewards/    (RewardSettings, RedemptionRequests)
│   │   │                     │   └── Student/Rewards/ (RewardsDashboard, Leaderboard, RedeemRewards)
│   │   ├── services/         # Axios API clients (auth, lost/found items, matches, claims,
│   │   │                     # notifications, rewards, admin, my)
│   │   ├── utils/            # image.js (URL resolution + legacy image detection)
│   │   ├── App.jsx           # route definitions (public / user / admin)
│   │   └── main.jsx          # entry point
│   ├── vercel.json           # Vercel SPA configuration (rewrites)
│   ├── vite.config.js
│   └── package.json
│
└── render.yaml               # Render backend service definition
```

---

## Main User Workflow

```
User registers / logs in
        ↓
Reports a LOST item ────────────┐        Reports a FOUND item
  (date ≤ today, image →        │          (date ≤ today, image → Cloudinary)
   Cloudinary)                  │                   │
        ↓                       │                   ▼
Fast attribute pre-match        │        Async hybrid matching vs open lost items
        ↓                       │                   │
Async hybrid AI matching vs    ◄───────────────────┘
open found items (background queue)
        ↓
High-confidence match? → real-time notification to owner + admins
        ↓
Owner submits a claim (proof: marks, details, date, optional image)
  · against a match, or directly on the found item
        ↓
Admin VERIFIES the claim (or rejects it)
        ↓
Admin marks the item RETURNED (physical handover confirmed)
        ↓
Finder reward awarded automatically — exactly once, server-side
        ↓
In-app notifications to owner, finder, and admins
        ↓
Metrics reflected in admin analytics (recovery rate, claims, engine breakdown)
```

Users can browse/search all listings, view their own reports and claim status under **My Reports**, check AI match analysis with engine provenance, manage their reward points, redeem vouchers, and view the leaderboard.

---

## Admin Workflow

Admins operate the dedicated portal (`/admin`):

- **Dashboard & analytics** — platform stats, recovery rate, AI engine breakdown
- **User management** — full user directory with contact details
- **Item oversight** — view (with private fields) and delete lost/found reports
- **Match review pipeline** — side-by-side comparison with the full AI breakdown; **Verify** (confirms a real match) → **Returned** (handover done, triggers reward) or **Reject** (false positive; items return to the matching pool)
- **Claim review** — list claims, inspect proof, **Verify / Reject** pending claims, and **mark verified claims as Returned** (which synchronizes items/matches and awards the finder reward atomically)
- **Rewards administration** — configure category point values and process voucher redemption requests
- **Notifications** — admin-room notifications for new reports, claims, high-confidence matches, and returns

---

## AI Matching Explanation

*(A short technical summary, useful for presentations and interviews.)*

The matching engine is **hybrid multi-modal**: each lost/found pair is scored on five independent evidence channels — visual, two textual, location, and category — combined with fixed weights (60/15/15/5/5) into a single 0–100 confidence score.

- **Image evidence:** both photos are sent to the Gemini Vision API, which compares object *content* (shape, purpose, category) rather than raw colors — a black wallet and a black phone score low even if pixel palettes match.
- **Text evidence:** titles, descriptions, and locations are embedded with the Gemini embedding model (768 dimensions, pinned for comparability) and compared by cosine similarity. Text is normalized with a campus-domain synonym dictionary (phone/mobile/smartphone…) and stopword filtering. If the API is unavailable, a deterministic local hashing vector is used.
- **Availability-aware scoring:** if one report has no image, the image slot is filled by an identity score derived from item-type/category text (capped at 95) — so text evidence can carry the match, but missing evidence cannot fake perfection. If Gemini fails, a conservative deterministic image engine (capped at 60) takes over, and the Match record says so via `imageEngine`/`imageEngineReason`.
- **Domain safeguards:** a category compatibility matrix plus hard caps for known-conflicting pairs prevent implausible matches (wallet ≠ laptop), regardless of textual similarity.
- **Explainability:** every match stores which fields contributed, a plain-language explanation, and the full scoring log — the admin UI renders this breakdown, and the overall number shown to users is always the combined confidence, never the raw image score.

---

## API Overview

Base URL: `{backend}/api` — all responses use the envelope `{ success, message, data }`. All routes except `register`, `login`, and `health` require a Bearer JWT; admin routes additionally require the `admin` role.

> The backend also contains legacy password-reset OTP routes inherited from an earlier iteration; email delivery is intentionally not configured and they are **not** part of the current feature set, so they are not listed here.

### Health

| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | API status check |

### Authentication (`/api/auth`)

| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Public (rate-limited) | Create a `user` account |
| `POST` | `/login` | Public (rate-limited) | Authenticate, returns JWT |
| `GET` | `/me` | Private | Current user profile |
| `PUT` | `/me` | Private | Update profile |
| `PUT` | `/complete-profile` | Private | Complete mandatory initial profile |

### Lost Items (`/api/lost`) & Found Items (`/api/found`)

Identical route shapes for both domains:

| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/` | Private | Create report (multipart; image → Cloudinary; future dates rejected; triggers async matching) |
| `GET` | `/` | Private | List with `search`, `category`, `location`, `page`, `limit` |
| `GET` | `/:id` | Private | Detail (private fields only for owner/admin) |
| `PUT` | `/:id` | Private | Update (owner only; re-triggers matching) |
| `DELETE` | `/:id` | Private | Delete (owner only; cleans up matches) |

### Matching (`/api/matches`)

| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Private | All match records |
| `GET` | `/status/:itemType/:itemId` | Private | Async matching status for an item |
| `GET` | `/:foundItemId` | Private | Matches for a specific found item |

### My Reports (`/api/my`)

| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/lost` | Private | Current user's lost reports |
| `GET` | `/found` | Private | Current user's found reports |
| `GET` | `/matches` | Private | Matches relevant to the current user |

### Claims (`/api/claims`)

| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/` | Private | Submit claim (self-claims rejected with 403; match-based or direct) |
| `GET` | `/my-claims` | Private | Current user's claims with status |

### Notifications (`/api/notifications`)

| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Private | List notifications |
| `PATCH` | `/read-all` | Private | Mark all as read |
| `PATCH` | `/:id/read` | Private | Mark one as read |
| `DELETE` | `/:id` | Private | Delete a notification |

### Rewards (`/api/rewards`)

| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/my-rewards` | Private | Points balance, level, and history |
| `GET` | `/leaderboard` | Private | Platform-wide finder rankings |
| `POST` | `/redeem` | Private | Redeem points (cost resolved server-side from the catalog) |

### Admin (`/api/admin`)

| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/stats` | Admin | Platform analytics (see Analytics) |
| `GET` | `/users` | Admin | User directory |
| `GET` | `/lost` · `/found` | Admin | All reports incl. private fields |
| `DELETE` | `/lost/:id` · `/found/:id` | Admin | Remove a report |
| `GET` | `/matches` · `/match/:id` | Admin | Match review data with full AI breakdown |
| `PUT` | `/match/:id/verify` | Admin | Verify a match (propagates to items) |
| `PUT` | `/match/:id/reject` | Admin | Reject a false positive |
| `PUT` | `/match/:id/returned` | Admin | Mark returned → atomic finder reward |
| `GET` | `/claims` | Admin | All claims |
| `PUT` | `/claim/:id/verify` · `/claim/:id/reject` | Admin | Verify or reject a pending claim |
| `PATCH` | `/claim/:id/return` | Admin | Mark verified claim returned → syncs items/match, awards reward once |

### Admin Rewards (`/api/admin/rewards`)

| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/config` · `PUT` `/config` | Admin | View/update category point rules |
| `GET` | `/requests` | Admin | Voucher redemption requests |
| `PUT` | `/request/:id/:action` | Admin | Approve/reject a redemption |

---

## Environment Variables

Real secret values must never be committed to GitHub — configure them in `backend/.env` locally and in the Render/Vercel dashboards for deployment.

### Backend (`backend/.env`)

| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `MONGO_URI` | Yes | MongoDB (Atlas) connection string | `mongodb+srv://<user>:<pass>@cluster.../lost-and-found` |
| `JWT_SECRET` | Yes | Secret used to sign tokens | `a_long_random_string` |
| `JWT_EXPIRES_IN` | No | Token lifetime (default `7d`) | `7d` |
| `CLIENT_URL` | Yes (prod) | Allowed frontend origin(s), comma-separated; consumed by the shared CORS policy | `https://your-frontend.vercel.app` |
| `GEMINI_API_KEY` | Recommended | Enables Gemini Vision + text embeddings; without it the deterministic fallbacks are used | `AIza...` |
| `CLOUDINARY_CLOUD_NAME` | Yes (prod) | Cloudinary cloud name | `your_cloud_name` |
| `CLOUDINARY_API_KEY` | Yes (prod) | Cloudinary API key | `1234567890` |
| `CLOUDINARY_API_SECRET` | Yes (prod) | Cloudinary API secret | `your_api_secret` |
| `PORT` | No | Server port (default `5000`) | `5000` |
| `NODE_ENV` | No | `development` / `production` | `production` |
| `RESTRICT_EMAIL_DOMAIN` | No | `true` restricts registration to allowed domains | `false` |
| `ALLOWED_EMAIL_DOMAINS` | No | Comma-separated domains (used when restriction is on) | `campus.edu,college.edu` |
| `AI_IMAGE_MATCH_THRESHOLD` | No | Confidence threshold for the AI-match flag (default `80`) | `80` |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | No | Credentials used only by the admin seed script | `Administrator` |

> No SMTP/email variables are used — notifications are in-app only.

### Frontend (`frontend/.env`)

| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE_URL` | Yes | Backend API base URL | `http://localhost:5000/api` (dev) / `https://your-backend.onrender.com/api` (prod) |

---

## Testing

The backend ships 77 tests across 6 self-contained suites (Node's built-in runner with custom assertions; no extra test dependencies required). All suites and the frontend production build were verified green at the current commit.

| Suite | File | Tests | Command (from `backend/`) |
| :--- | :--- | :---: | :--- |
| Matching service unit tests | `tests/matchingService.test.js` | 8/8 | `npm test` |
| Hybrid matching engine | `tests/hybridMatching.test.js` | 7/7 | `npm run test:hybrid` |
| Phase 1 — security, validation, business rules | `tests/phase1.test.js` | 23/23 | `node tests/phase1.test.js` |
| Phase 2 — claim lifecycle & reward guards | `tests/phase2.test.js` | 16/16 | `node tests/phase2.test.js` |
| Phase 3 — matching confidence & fallback | `tests/phase3.test.js` | 15/15 | `node tests/phase3.test.js` |
| Phase 4 — analytics, images, provenance | `tests/phase4.test.js` | 8/8 | `node tests/phase4.test.js` |
| **Total** | | **77/77** | |

Frontend production build:

```bash
cd frontend
npm run build   # ✓ vite build passes
```

---

## Deployment

| Component | Platform | Notes |
| :--- | :--- | :--- |
| **Frontend** | Vercel | SPA with rewrites (`frontend/vercel.json`); build `npm run build`, output `dist`; env `VITE_API_BASE_URL` |
| **Backend** | Render | Web service defined in `render.yaml` (root dir `backend`, build `npm install`, start `node server.js`) |
| **Database** | MongoDB Atlas | Connection via `MONGO_URI` |
| **Images** | Cloudinary | Persistent storage via `CLOUDINARY_*` variables |

Live URLs:

- **Frontend:** https://lost-found-matching-platform-sv2h.vercel.app
- **Backend API:** https://lost-found-matching-platform.onrender.com/api (root `/api/health` returns a status JSON — it is an API service, not a webpage)

Deploying your own instance: push the repository, connect the frontend project to Vercel (root `frontend`) and the backend to Render using `render.yaml`, then set the environment variables listed above in each dashboard. Admin accounts are provisioned with the seed scripts:

```bash
cd backend
npm run seed:admin                                            # reads ADMIN_* from .env
npm run seed:admin -- --reset                                 # reset admin password
npm run create-admin -- "Admin Name" admin@campus.edu "Pass"  # explicit create/promote
```

---

## Current Version

**Version 2** — completed four-phase upgrade, verified working baseline.

- **Latest commit:** `c4e658e` — *Fix self-found action visibility for lost item owners*
- Phase 1: security hardening, validation, and core business rules
- Phase 2: claim → verification → return → reward lifecycle with atomic reward guards
- Phase 3: AI matching confidence improvements, engine provenance, and principled no-image handling
- Phase 4: analytics rewrite, Cloudinary image handling, and UI cleanup
- Test status at this commit: 77/77 backend tests passing; frontend production build passing

---

## Known Limitations

- **Legacy images:** photos uploaded before the Cloudinary migration lived on an ephemeral filesystem and cannot be recovered; the UI shows a placeholder for them.
- **Legacy match records:** matches created before engine-provenance tracking display the `Legacy` engine label (backward-compatible, no migration needed).
- **In-memory rate limiting:** counters reset on server restart and are per-instance (a deliberate trade-off for a single-node deployment).
- **Free-tier cold starts:** the Render free tier can take tens of seconds to respond after inactivity.
- A small number of legacy notification records from earlier development iterations may remain in the production database.

---

## Future Improvements

- Mobile app (or PWA) with push notifications and camera-first reporting
- Interactive campus map with location pins and lost-item hotspots
- QR/NFC tags for personal belongings enabling one-tap anonymous owner contact
- OCR on uploaded photos to auto-extract names/IDs from textbooks and cards
- Anonymized in-app chat between owner and finder for safe handover scheduling
- Analytics export (CSV/PDF) for the Lost & Found office

---

## Team / Contributors

Built as a college team project. See the [commit history](https://github.com/charansai023/Lost-Found-Matching-Platform/commits/main) for individual contributions.
