# Lost & Found Matching Platform

A full-stack MERN application featuring a **Hybrid AI Matching Engine**, **real-time WebSocket notifications**, **item claim verification**, **Cloudinary cloud media storage**, and an integrated **Student Karma Rewards & Gamification system**.

When a user reports a lost or found item, the platform automatically processes the report through an asynchronous matching queue and computes multi-dimensional match scores combining **Gemini Vision AI**, **512-dimensional semantic text & image embeddings**, **synonym dictionary token normalization**, **geospatial location proximity**, and **explainable AI (XAI)** reasoning.

---

## Key Features

- 🔍 **Hybrid AI Matching Engine (v2)**: Multi-modal scoring algorithm evaluating image features (60%), title (15%), description (15%), location (5%), and category validation (5%).
- 🖼️ **Multimodal Vision & Cloud Media Storage**: Google Gemini 1.5 Flash Vision AI analysis for visual object recognition with Cloudinary cloud storage or local storage support.
- 💡 **Explainable AI (XAI)**: Generates human-readable explanations detailing why a match score was assigned, backed by field-level contributor checklists.
- ⚡ **Async Background Queue**: Non-blocking background processing queue (`asyncMatchingQueue`) that executes heavy AI matching operations asynchronously.
- 🔔 **Real-time Notifications**: Socket.IO WebSockets deliver instant notifications for new match alerts, claim status updates, and admin actions, with an in-app notification dropdown menu.
- 📑 **Item Claim & Proof Verification**: Interactive claim modal allowing users to claim found items by uploading proof of ownership or answering security questions, reviewed via an admin verification workflow.
- 🎁 **Gamification & Rewards System**: Student Karma Points awarded for reporting items and returning verified lost belongings, with a redeemable voucher catalog, student leaderboard, and admin redemption request management.
- 🔐 **Role-Based Access Control (RBAC) & Profile Completion**: Differentiated user/student and admin workflows, complete profile modal enforcement, and optional university email domain restriction (`@campus.edu`).
- 🔑 **OTP Password Recovery**: Secure email-based OTP password recovery via Nodemailer (Brevo/SMTP) with console log fallback for local development.
- 📊 **Comprehensive Admin Management Portal**: Analytics overview dashboard, full user management, lost/found item oversight, match verification (`Verify` → `Returned` / `Reject` false positives), claim request approvals, and reward system controls.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React (Vite 8), React Router v6, Axios, Socket.io-Client, CSS3 |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB, Mongoose ORM |
| **AI / Machine Learning** | Google Gemini Vision & Text Embedding API (`text-embedding-004`), 512D Cosine Similarity Feature Extractor |
| **Real-Time Communication**| Socket.IO |
| **Media / File Storage** | Cloudinary (`multer-storage-cloudinary`), Multer (Local Fallback) |
| **Authentication & Security** | JWT (JSON Web Tokens), bcryptjs |
| **Email Services** | Nodemailer (Brevo / SMTP integration) |
| **Deployment** | Render (Backend `render.yaml`), Vercel (Frontend `vercel.json`) |
| **Testing** | Node native test runner (`matchingService.test.js`, `hybridMatching.test.js`) |

---

## Access Control & Role Management

Two primary user roles exist: `user` (Student/Staff) and `admin`.

- **Public**: Home landing page, Login, Register, Forgot Password / OTP Reset.
- **Private / User** (`user` role): Dashboard, Report Lost Item, Report Found Item, Item Listings & Detail Views, Claim Modal, My Reports & Matches, Rewards Dashboard, Leaderboard, Voucher Redemption, Profile Management.
- **Private / Admin** (`admin` role): Admin Management Portal (`/admin`), Platform Statistics, User Directory, Lost & Found Item Moderation, Match Verification Pipeline, Claim Request Approvals, Rewards System Configuration, and Voucher Redemption Request Management.

### Admin Provisioning & Seeding

Admin accounts can be seeded or created using the CLI helper scripts:

```bash
cd backend

# Seed or create default admin account (reads credentials from ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD in .env)
npm run seed:admin

# Reset password for an existing admin account
npm run seed:admin -- --reset

# Create or promote a specific user to admin manually
npm run create-admin -- "Admin Name" admin@campus.edu "StrongPassword123"
```

---

## Project Structure

```text
lost-and-found-platform/
│
├── backend/
│   ├── config/              # MongoDB connection & Cloudinary setup
│   ├── controllers/         # Request handlers (Auth, Lost/Found, Matches, Claims, Notifications, Rewards, Admin)
│   ├── middleware/          # JWT Auth, Admin check, Error handling, Multer image upload, Input validation
│   ├── models/              # Mongoose Schemas (User, LostItem, FoundItem, Match, Claim, Notification, PasswordOTP, RewardConfig, RewardHistory, RedemptionRequest)
│   ├── routes/              # Express API route definitions
│   ├── scripts/             # Admin seeding & password reset tools (createAdmin.js, seedAdmin.js, recalculateMatches.js)
│   ├── services/            # Core business logic:
│   │   ├── matchingService.js       # Hybrid AI Engine scoring & XAI explanation generator
│   │   ├── imageSimilarityService.js# Gemini Vision AI & 512D image feature vector extractor
│   │   ├── textEmbeddingService.js # Gemini Text Embeddings, local vector generator & synonym normalizer
│   │   ├── asyncMatchingQueue.js   # Non-blocking async background job matching queue
│   │   ├── socketService.js        # Socket.IO connection manager & real-time notification emitter
│   │   └── rewardService.js        # Karma points calculator & reward history recorder
│   ├── tests/               # Matching engine integration test suites (matchingService.test.js, hybridMatching.test.js)
│   ├── uploads/             # Static file storage for local image fallback
│   ├── utils/               # ApiError, ApiResponse, asyncHandler helpers
│   ├── app.js               # Express application configuration & CORS policy
│   ├── server.js            # Node HTTP server entry point with Socket.IO integration
│   └── package.json
│
├── frontend/
│   ├── public/              # Static assets & favicon
│   ├── src/
│   │   ├── components/      # Navbar, ItemCard, MatchBadge, NotificationBell, AiMatchAnalysis, ClaimModal, CompleteProfile, IFoundThisItemModal, PrivateRoute, AdminRoute, Loader
│   │   ├── context/         # AuthContext (JWT handling, user state & socket connectivity)
│   │   ├── hooks/           # Custom React hooks (useAuth)
│   │   ├── pages/           # Application views:
│   │   │   ├── Admin/       # Admin rewards settings & redemption approval views
│   │   │   ├── Student/     # Student rewards dashboard, leaderboard & voucher redemption
│   │   │   ├── Home.jsx, Login.jsx, Register.jsx, ForgotPassword.jsx
│   │   │   ├── Dashboard.jsx, LostItemsList.jsx, FoundItemsList.jsx, LostItemDetail.jsx, FoundItemDetail.jsx
│   │   │   ├── ReportLostItem.jsx, ReportFoundItem.jsx, MyReports.jsx, Profile.jsx, AdminDashboard.jsx
│   │   ├── services/        # Axios API client modules (api.js, authService, itemService, matchService, claimService, notificationService, rewardService)
│   │   ├── App.jsx          # React Router v6 route definitions & layout structure
│   │   └── main.jsx         # Application entry point
│   ├── vercel.json          # Vercel deployment configuration
│   ├── vite.config.js       # Vite build configuration
│   └── package.json
│
└── render.yaml              # Render backend deployment configuration
```

---

## Getting Started

### Prerequisites

- **Node.js**: v18.x or higher
- **Database**: Running MongoDB instance (Local or MongoDB Atlas)
- **Optional Services**:
  - Cloudinary account for cloud image uploads
  - Google Gemini API key for AI vision & semantic text embedding
  - SMTP credentials (e.g. Brevo) for email notifications & OTP password reset

### 1. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Edit .env with your MONGO_URI, JWT_SECRET, and optional API keys

# Seed default admin account
npm run seed:admin

# Start development server with Nodemon
npm run dev
```

The backend server will start at `http://localhost:5000`.

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Start Vite development server
npm run dev
```

The frontend application will be available at `http://localhost:5173`.

---

## Environment Variables

### Backend Environment Variables (`backend/.env`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Backend server port | `5000` |
| `NODE_ENV` | Environment mode (`development` / `production`) | `development` |
| `CLIENT_URL` | Frontend URL for CORS authorization | `http://localhost:5173` |
| `MONGO_URI` | MongoDB connection URI | `mongodb://127.0.0.1:27017/lost-and-found` |
| `JWT_SECRET` | Secret key for signing JSON Web Tokens | `your_secure_jwt_secret_key` |
| `JWT_EXPIRES_IN` | JWT expiration timeframe | `7d` |
| `ADMIN_NAME` | Default admin account name for seeder | `Administrator` |
| `ADMIN_EMAIL` | Default admin account email for seeder | `admin@campus.com` |
| `ADMIN_PASSWORD` | Default admin account password for seeder | `Admin@123` |
| `RESTRICT_EMAIL_DOMAIN` | Restrict user registration to specified domains | `false` |
| `ALLOWED_EMAIL_DOMAINS` | Comma-separated list of allowed email domains | `campus.edu,college.edu` |
| `GEMINI_API_KEY` | *(Optional)* Google Gemini API key for Vision & Embeddings | `AIzaSy...` |
| `AI_IMAGE_MATCH_THRESHOLD`| Score threshold for high AI match classification | `80` |
| `CLOUDINARY_CLOUD_NAME` | *(Optional)* Cloudinary Cloud Name for image storage | `your_cloud_name` |
| `CLOUDINARY_API_KEY` | *(Optional)* Cloudinary API Key | `1234567890` |
| `CLOUDINARY_API_SECRET` | *(Optional)* Cloudinary API Secret | `your_cloudinary_secret` |
| `SMTP_HOST` | *(Optional)* SMTP server hostname for emails & OTP | `smtp-relay.brevo.com` |
| `SMTP_PORT` | *(Optional)* SMTP port | `587` |
| `SMTP_USER` | *(Optional)* SMTP user login | `your_smtp_login` |
| `SMTP_PASS` | *(Optional)* SMTP password | `your_smtp_password` |
| `FROM_EMAIL` | *(Optional)* Sender email address | `no-reply@campus.edu` |
| `FROM_NAME` | *(Optional)* Sender display name | `Lost & Found Platform` |

### Frontend Environment Variables (`frontend/.env`)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:5000/api` |

---

## API Documentation

All API responses strictly adhere to the standardized response envelope:

```json
{
  "success": true,
  "message": "Descriptive response message",
  "data": {}
}
```

### Authentication & Profile (`/api/auth`)

| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register a new user account |
| `POST` | `/api/auth/login` | Public | Authenticate user & return JWT token |
| `POST` | `/api/auth/forgot-password/send-otp` | Public | Send password reset OTP code via email |
| `POST` | `/api/auth/forgot-password/verify-otp` | Public | Verify validity of 6-digit OTP code |
| `POST` | `/api/auth/forgot-password/reset` | Public | Reset account password using verified OTP |
| `GET` | `/api/auth/me` | Private | Get profile details of authenticated user |
| `PUT` | `/api/auth/me` | Private | Update authenticated user's profile details |
| `PUT` | `/api/auth/complete-profile` | Private | Complete mandatory initial profile setup |

### Lost Items (`/api/lost`)

| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/lost` | Private | Report a lost item (supports image upload via `multipart/form-data`) |
| `GET` | `/api/lost` | Private | Search & list lost items (supports `search`, `category`, `location`, `page`, `limit`) |
| `GET` | `/api/lost/:id` | Private | Retrieve detailed view of a specific lost item |
| `PUT` | `/api/lost/:id` | Private | Update lost item report (owner only) |
| `DELETE` | `/api/lost/:id` | Private | Delete lost item report (owner only) |

### Found Items (`/api/found`)

| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/found` | Private | Report a found item (triggers non-blocking async match queue) |
| `GET` | `/api/found` | Private | Search & list found items (supports filtering & pagination) |
| `GET` | `/api/found/:id` | Private | Retrieve detailed view of a specific found item |
| `PUT` | `/api/found/:id` | Private | Update found item report (owner only) |
| `DELETE` | `/api/found/:id` | Private | Delete found item report (owner only) |

### Matches & AI Analysis (`/api/matches`)

| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/matches` | Private | Fetch all calculated match records (score >= 40) |
| `GET` | `/api/matches/:foundItemId` | Private | Fetch match records for a specific found item |
| `GET` | `/api/matches/status/:itemType/:itemId` | Private | Check async matching queue status for a reported item |

### Item Claims (`/api/claims`)

| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/claims` | Private | Submit ownership claim for a found item with text proof/answers & optional proof image |
| `GET` | `/api/claims/my-claims` | Private | List claims submitted by the logged-in user |

### Real-time Notifications (`/api/notifications`)

| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/notifications` | Private | Fetch notifications for logged-in user |
| `PATCH` | `/api/notifications/read-all` | Private | Mark all notifications as read |
| `PATCH` | `/api/notifications/:id/read` | Private | Mark specific notification as read |
| `DELETE` | `/api/notifications/:id` | Private | Delete notification |

### Karma Rewards & Gamification (`/api/rewards`)

| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/rewards/my-rewards` | Private | View student Karma points balance, tier status & points history |
| `GET` | `/api/rewards/leaderboard` | Private | View platform-wide student leaderboard rankings |
| `POST` | `/api/rewards/redeem` | Private | Submit request to redeem points for reward vouchers |

### Admin Management Portal (`/api/admin`)

| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/stats` | Admin | Get platform metrics (total items, resolution rate, match stats) |
| `GET` | `/api/admin/users` | Admin | List all registered users |
| `GET` | `/api/admin/lost` | Admin | Manage all reported lost items |
| `GET` | `/api/admin/found` | Admin | Manage all reported found items |
| `GET` | `/api/admin/matches` | Admin | Review match predictions across platform |
| `GET` | `/api/admin/match/:id` | Admin | Retrieve match detail record & explainable AI breakdown |
| `PUT` | `/api/admin/match/:id/verify` | Admin | Verify match authenticity (confirms potential lead) |
| `PUT` | `/api/admin/match/:id/reject` | Admin | Reject false positive match |
| `PUT` | `/api/admin/match/:id/returned` | Admin | Mark verified item as successfully returned to owner |
| `DELETE`| `/api/admin/lost/:id` | Admin | Remove inappropriate lost item report |
| `DELETE`| `/api/admin/found/:id` | Admin | Remove inappropriate found item report |
| `GET` | `/api/admin/claims` | Admin | Review all pending item claims |
| `PUT` | `/api/admin/claim/:id/:action` | Admin | Approve (`approve`) or reject (`reject`) an item claim |
| `GET` | `/api/admin/rewards/config` | Admin | Fetch system rewards point allocation rules |
| `PUT` | `/api/admin/rewards/config` | Admin | Update system reward point rules |
| `GET` | `/api/admin/rewards/requests` | Admin | List pending voucher redemption requests |
| `PUT` | `/api/admin/rewards/request/:id/:action` | Admin | Process voucher redemption (`approve` / `reject`) |

---

## The Hybrid AI Matching Engine

The core matching service (`backend/services/matchingService.js`) employs a hybrid multi-modal architecture combining deep visual representation, natural language embeddings, synonym normalization, and spatial heuristics.

### Weighted Scoring Formula

$$\text{Final Score} = 0.60 \times S_{\text{image}} + 0.15 \times S_{\text{title}} + 0.15 \times S_{\text{description}} + 0.05 \times S_{\text{location}} + 0.05 \times S_{\text{category}}$$

- **Visual Feature Analysis (60%)**: Powered by Google Gemini 1.5 Flash Vision API (or fallback 512D neural shape & contour feature vector cosine similarity).
- **Title Semantic Embeddings (15%)**: Evaluated using Google Gemini `text-embedding-004` (or fallback local word-hashing vector cosine similarity).
- **Description Semantic Text (15%)**: Cosine similarity of description embeddings enriched with synonym mapping.
- **Location Similarity (5%)**: Tokenized location overlap & semantic proximity.
- **Category Compatibility (5%)**: Category and item type validation matrix with domain constraint penalties.

### Classification & Hard Caps

- **High Match**: Score $\ge 70\%$
- **Possible Match**: $40\% \le \text{Score} < 70\%$
- **Low / No Match**: Score $< 40\%$

**Smart Penalties & Hard Caps**:
- Missing images limit maximum match score to **85%**.
- Incompatible top-level categories apply a category penalty capping match score to **30%**.
- Conflicting entity pairs (e.g. *Wallet vs Mobile Phone / Laptop*) are strictly capped at **20%**.

---

## Testing

Run unit and integration test suites for the matching engine:

```bash
cd backend

# Run standard matching service unit tests
npm test

# Run Hybrid AI Matching Engine integration test suite
npm run test:hybrid
```

---

## Deployment

### Backend (Render Deployment)
The repository includes a `render.yaml` infrastructure configuration. To deploy:
1. Connect the repository to **Render**.
2. Deploy as a Web Service selecting the `backend` directory.
3. Configure environment variables (`MONGO_URI`, `JWT_SECRET`, `CLOUDINARY_*`, `GEMINI_API_KEY`, etc.).

### Frontend (Vercel Deployment)
The repository includes a `frontend/vercel.json` configuration for Vite SPA rewrites:
1. Connect the project to **Vercel**.
2. Set root directory to `frontend`.
3. Set build command to `npm run build` and output directory to `dist`.
4. Configure `VITE_API_BASE_URL` pointing to your deployed backend.

---

## Future Improvements

To further enhance the platform's capabilities, user experience, and scalability, the following improvements are planned for future releases:

1. 📱 **Mobile Native Applications (React Native / Flutter)**
   - Develop dedicated iOS and Android mobile apps featuring push notifications via Firebase Cloud Messaging (FCM), native camera access for instant item snapshot reporting, and offline draft reporting.

2. 📍 **GPS & Interactive Geofenced Campus Mapping**
   - Integrate interactive maps (e.g. Leaflet / Mapbox) allowing users to place precise loss/found location pins and view heatmap clusters of lost item hotspots across campus.

3. 🏷️ **QR Code & NFC Belonging Tagging**
   - Provide printable, unique QR code / NFC tag generation for users to attach to valuable personal belongings (laptops, keys, student ID cards). Scanning a lost tag opens a 1-click anonymized return contact form.

4. 🏢 **Multi-Tenant Campus & Enterprise Isolation**
   - Expand database architecture to support multi-tenancy, enabling multiple universities or corporate campuses to run isolated lost-and-found portals under custom subdomains while sharing underlying infrastructure.

5. 📄 **Automated Optical Character Recognition (OCR)**
   - Implement Tesseract / Gemini OCR text extraction on uploaded item photos to automatically read student names, ID numbers, or labels on lost textbooks, identity cards, and equipment.

6. 💬 **In-App Messaging & Anonymized Chat**
   - Introduce an end-to-end anonymized chat system between lost item owners and item finders to facilitate safe meetup scheduling without sharing personal phone numbers or email addresses.

7. 📲 **WhatsApp & SMS Automated Alerts**
   - Integrate Twilio / WhatsApp Business API to deliver instant SMS and WhatsApp text notifications when high-confidence AI matches are detected.

8. 📊 **Advanced Analytics & CSV/PDF Report Exporting**
   - Add detailed analytics reporting for administrators, including resolution time metrics, item recovery rates, category trends, and automated PDF export generation for Lost & Found Office record keeping.
