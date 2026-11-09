Lost & Found Matching Platform
Overview
The Lost & Found Matching Platform is a full-stack MERN web application
designed primarily for college campuses. It helps students report lost
and found belongings, discover potential matches, submit ownership
claims, and recover items through an admin-assisted verification
process.
On a campus, identifying the correct item among many reports can be
difficult. Different people may also describe the same object in
different ways. For example, one student may report a "black backpack",
while another describes it as a "dark-colored bag". Simple keyword
matching may fail to connect these reports.
This project addresses that problem through a hybrid AI matching engine.
It analyzes multiple signals, including image similarity, semantic text
similarity, location, and category, to rank potential lost-and-found
matches. Matching runs through an asynchronous background queue so that
item submission does not have to wait for the complete matching process.
The platform also includes real-time notifications, item claim and proof
verification, admin management, and a student rewards system.
Features
Allows users to report lost and found items with descriptions,
categories, locations, dates, and images.
Uses a hybrid AI matching engine to identify potential
lost-and-found matches.
Combines image similarity, semantic title and description
similarity, location, and category signals.
Uses Gemini Vision and text embedding capabilities for AI-assisted
matching.
Generates match scores and human-readable explanations for potential
matches.
Processes matching jobs asynchronously in the background.
Sends real-time notifications using Socket.IO.
Supports item claims with proof of ownership or security-question
answers.
Provides admin review and verification of potential matches and
claims.
Supports item status management, including verified, returned, and
rejected outcomes.
Provides separate user/student and admin experiences using
role-based access control.
Supports JWT authentication and bcrypt password hashing.
Includes email OTP-based password recovery.
Stores uploaded images using Cloudinary, with local upload fallback
support.
Provides a student Karma points, rewards, voucher redemption, and
leaderboard system.
Includes an admin dashboard for users, items, matches, claims,
rewards, and platform statistics.
Supports profile completion and optional university email-domain
restrictions.
Technologies Used
Programming Language
JavaScript
Node.js
Frontend
React
Vite
React Router
Axios
Socket.IO Client
CSS3
Backend
Node.js
Express.js
Database
MongoDB
Mongoose
Artificial Intelligence
Google Gemini Vision
Google Gemini Text Embeddings (`text-embedding-004`)
Cosine similarity
Hybrid weighted scoring
Semantic text similarity and synonym normalization
Authentication and Security
JSON Web Tokens (JWT)
bcryptjs
Role-Based Access Control (RBAC)
Express middleware
Image and File Storage
Cloudinary
Multer
Local upload fallback
Real-Time Communication and Email
Socket.IO
Nodemailer
Brevo / SMTP integration
Testing and Deployment
Node.js native test runner
Render
Vercel
Project Structure
``` text
Lost-Found-Matching-Platform/
│
├── backend/
│   ├── config/                  # MongoDB and Cloudinary configuration
│   ├── controllers/             # Request handlers for application features
│   ├── middleware/              # Authentication, authorization, validation,
│   │                            # file upload, and error handling
│   ├── models/                  # Mongoose models
│   ├── routes/                  # Express API routes
│   ├── scripts/                 # Admin seeding and maintenance scripts
│   ├── services/                # Matching, AI, queue, socket, and reward logic
│   │   ├── matchingService.js
│   │   ├── imageSimilarityService.js
│   │   ├── textEmbeddingService.js
│   │   ├── asyncMatchingQueue.js
│   │   ├── socketService.js
│   │   └── rewardService.js
│   ├── tests/                   # Matching engine tests
│   ├── uploads/                 # Local image upload fallback
│   ├── utils/                   # Shared API and async utilities
│   ├── app.js                   # Express application setup
│   ├── server.js                # HTTP server and Socket.IO setup
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── public/                  # Static assets
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── context/             # Authentication context
│   │   ├── hooks/               # Custom React hooks
│   │   ├── pages/               # User, student, and admin pages
│   │   ├── services/            # Axios API service modules
│   │   ├── App.jsx              # Application routes and layout
│   │   └── main.jsx             # React entry point
│   ├── vercel.json
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example
│
├── render.yaml                  # Render deployment configuration
└── README.md
```
Hybrid AI Matching Workflow
The central feature of the platform is its hybrid AI matching engine. It
compares a newly reported item with suitable reports of the opposite
type and calculates a score representing how closely the reports match.
Step 1: Item Submission
A user submits a lost or found item with information such as:
Item title
Description
Category
Location
Date
Image (optional)
The backend validates the request, handles the image upload, and saves
the item information in MongoDB.
Step 2: Asynchronous Matching Queue
After an item is saved, the backend adds a matching job to the
asynchronous matching queue.
The API can return the item-submission response without waiting for all
AI matching operations to finish. The background matching process then
searches for candidate reports and evaluates them.
Step 3: Candidate Selection
The matching service identifies relevant reports of the opposite type.
For example, a newly submitted found item is compared with suitable
lost-item reports.
Step 4: Image Similarity
The image similarity service uses Gemini Vision capabilities and image
feature representations to assess visual similarity between uploaded
item images.
Step 5: Semantic Text Similarity
The text embedding service creates vector representations of item titles
and descriptions. Cosine similarity is used to compare the semantic
representations, helping identify related descriptions even when users
use different words.
Synonym normalization and fallback similarity logic help improve
matching when exact words differ.
Step 6: Hybrid Score Calculation
The matching engine combines multiple signals using the following
weighted scoring formula:
Matching Factor              Weight
---
Image similarity                60%
Title similarity                15%
Description similarity          15%
Location similarity              5%
Category compatibility           5%
Total                  100%
Conceptually:
``` text
Final Match Score =
    (Image Similarity × 0.60) +
    (Title Similarity × 0.15) +
    (Description Similarity × 0.15) +
    (Location Similarity × 0.05) +
    (Category Score × 0.05)
```
The engine also applies category and entity compatibility constraints so
that obviously incompatible items do not receive misleadingly high
scores.
Step 7: Match Classification
The platform classifies potential matches using score thresholds:
Match Category                Score
---
High Match             70% or above
Possible Match     40% to below 70%
Low / No Match            Below 40%
Additional scoring constraints documented by the project include:
Missing images limit the maximum match score to 85%.
Incompatible top-level categories cap the score at 30%.
Conflicting item entities, such as a wallet and a mobile phone, cap
the score at 20%.
Step 8: Save Matches and Notify Users
Potential matches are saved in MongoDB with their scores and explanation
details. Socket.IO is used to send real-time notifications when relevant
match or status events occur.
The match score is a suggestion, not proof of ownership. The claim and
admin verification workflow is used to review potential matches before
an item is marked as returned.
Application Workflow
Register or log in: A student creates an account or logs in
using JWT-based authentication.
Complete profile: Users complete the required profile
information. The application can optionally restrict registration to
approved university email domains.
Report an item: A user submits a lost or found report with item
details and an optional image.
Save the report: The backend validates and stores the report in
MongoDB and handles image storage.
Run matching in the background: The matching job is added to the
asynchronous queue and processed separately from the item-creation
request.
Calculate potential matches: The hybrid matching engine compares
relevant reports and calculates similarity scores.
Notify users: Socket.IO delivers notifications about potential
matches and relevant updates.
Submit a claim: A user can submit an ownership claim with
supporting text, security-question answers, or proof images,
depending on the claim flow.
Admin review: An administrator reviews the match or claim and
can verify, reject, or approve the relevant request.
Complete item recovery: Once the item is confirmed as returned,
the platform updates its status.
Award rewards: The student rewards system can award Karma points
for eligible reporting and verified returns.
Web Application Modules
User / Student Module
Registration and login.
Profile completion and profile management.
Report lost items.
Report found items.
Browse and search item reports.
View item details and potential matches.
Receive real-time notifications.
Submit ownership claims with supporting proof.
View personal reports and claims.
View Karma points, rewards, and leaderboard.
Submit voucher redemption requests.
Admin Module
Admin dashboard with platform statistics.
User management.
Lost and found report management.
Match review and verification.
Claim approval and rejection.
Item status management.
Rewards configuration.
Voucher redemption request management.
Database
MongoDB is used to store application data, and Mongoose provides schema
modelling and database operations.
The backend includes models for the major application entities,
including:
User
LostItem
FoundItem
Match
Claim
Notification
PasswordOTP
RewardConfig
RewardHistory
RedemptionRequest
These models support user accounts, item reports, match results,
ownership claims, notifications, password recovery, and rewards
management.
API Endpoints
The backend exposes REST APIs for authentication, item reports, matches,
claims, notifications, rewards, and admin management.
Authentication and Profile
---
Method                  Endpoint                                 Description
---
POST                    `/api/auth/register`                     Register a user.
POST                    `/api/auth/login`                        Authenticate and
receive a JWT.
POST                    `/api/auth/forgot-password/send-otp`     Send a password-reset
OTP.
POST                    `/api/auth/forgot-password/verify-otp`   Verify the OTP.
POST                    `/api/auth/forgot-password/reset`        Reset the password.
GET                     `/api/auth/me`                           Get the authenticated
user's profile.
PUT                     `/api/auth/me`                           Update the
authenticated user's
profile.
PUT                     `/api/auth/complete-profile`             Complete the user's
profile.
Lost Items
Method   Endpoint          Description
---
POST     `/api/lost`       Create a lost-item report.
GET      `/api/lost`       List and filter lost items.
GET      `/api/lost/:id`   Get a lost-item report.
PUT      `/api/lost/:id`   Update an owned lost-item report.
DELETE   `/api/lost/:id`   Delete an owned lost-item report.
Found Items
---
Method                  Endpoint                Description
---
POST                    `/api/found`            Create a found-item
report and trigger
background matching.
GET                     `/api/found`            List and filter found
items.
GET                     `/api/found/:id`        Get a found-item
report.
PUT                     `/api/found/:id`        Update an owned
found-item report.
DELETE                  `/api/found/:id`        Delete an owned
found-item report.
Matches and AI Analysis
---
Method                  Endpoint                                  Description
---
GET                     `/api/matches`                            Fetch calculated match
records.
GET                     `/api/matches/:foundItemId`               Fetch matches for a
specific found item.
GET                     `/api/matches/status/:itemType/:itemId`   Check matching status
for an item.
Claims
---
Method                  Endpoint                  Description
---
POST                    `/api/claims`             Submit an ownership
claim with supporting
proof.
GET                     `/api/claims/my-claims`   List claims submitted
by the logged-in user.
Notifications
---
Method                  Endpoint                        Description
---
GET                     `/api/notifications`            Fetch notifications.
PATCH                   `/api/notifications/read-all`   Mark all notifications
as read.
PATCH                   `/api/notifications/:id/read`   Mark one notification
as read.
DELETE                  `/api/notifications/:id`        Delete a notification.
Karma Rewards
---
Method                  Endpoint                     Description
---
GET                     `/api/rewards/my-rewards`    View points, tier, and
points history.
GET                     `/api/rewards/leaderboard`   View student
leaderboard rankings.
POST                    `/api/rewards/redeem`        Request voucher
redemption.
Admin Management
Method   Endpoint                          Description
---
GET      `/api/admin/stats`                View platform statistics.
GET      `/api/admin/users`                List registered users.
GET      `/api/admin/lost`                 Manage lost-item reports.
GET      `/api/admin/found`                Manage found-item reports.
GET      `/api/admin/matches`              Review match predictions.
GET      `/api/admin/match/:id`            View match details and explanation.
PUT      `/api/admin/match/:id/verify`     Verify a potential match.
PUT      `/api/admin/match/:id/reject`     Reject a false-positive match.
PUT      `/api/admin/match/:id/returned`   Mark an item as returned.
GET      `/api/admin/claims`               Review pending claims.
PUT      `/api/admin/claim/:id/:action`    Approve or reject a claim.
The admin API also includes user, item, rewards-configuration, and
voucher-redemption management routes. Check the backend route files for
the complete current route definitions.
Installation
Prerequisites
Make sure the following are installed:
Node.js 18 or newer.
npm.
MongoDB (local instance or MongoDB Atlas).
Google Gemini API key for AI image and text functionality.
Cloudinary account for cloud image storage (optional if using local
upload fallback).
SMTP / Brevo credentials for email and OTP functionality.
1. Clone the Repository
``` bash
git clone https://github.com/charansai023/Lost-Found-Matching-Platform.git
```
2. Move into the Project Directory
``` bash
cd Lost-Found-Matching-Platform
```
3. Backend Setup
``` bash
cd backend
npm install
```
Create the backend environment file:
``` bash
cp .env.example .env
```
Configure the required values in `backend/.env`. Refer to the
Environment Variables section below.
4. Create or Seed an Admin Account
To seed the default admin account using the configured admin environment
variables:
``` bash
npm run seed:admin
```
To reset the password for an existing seeded admin:
``` bash
npm run seed:admin -- --reset
```
To create or promote a specific user to admin:
``` bash
npm run create-admin -- "Admin Name" admin@campus.edu "StrongPassword123"
```
Use a strong password and do not commit real credentials to the
repository.
5. Start the Backend
``` bash
npm run dev
```
The backend runs at:
``` text
http://localhost:5000
```
6. Frontend Setup
Open another terminal from the project root:
``` bash
cd frontend
npm install
```
Create the frontend environment file:
``` bash
cp .env.example .env
```
Set the frontend API URL in `frontend/.env`:
``` env
VITE_API_BASE_URL=http://localhost:5000/api
```
7. Start the Frontend
``` bash
npm run dev
```
The Vite development server runs at:
``` text
http://localhost:5173
```
Open that address in your browser.
Environment Variables
Backend Environment Variables
Create `backend/.env` and configure the values expected by the backend.
---
Variable                            Description
---
`PORT`                              Backend server port.
`NODE_ENV`                          Application environment, such as
development or production.
`CLIENT_URL`                        Frontend origin allowed by CORS.
`MONGO_URI`                         MongoDB connection string.
`JWT_SECRET`                        Secret used to sign and verify
JWTs.
`JWT_EXPIRES_IN`                    JWT expiration duration.
`ADMIN_NAME`                        Name used by the admin seeder.
`ADMIN_EMAIL`                       Email used by the admin seeder.
`ADMIN_PASSWORD`                    Password used by the admin seeder.
`RESTRICT_EMAIL_DOMAIN`             Enables or disables university
email-domain restrictions.
`ALLOWED_EMAIL_DOMAINS`             Comma-separated list of permitted
email domains.
`GEMINI_API_KEY`                    Optional Gemini API key for vision
and embedding features.
`AI_IMAGE_MATCH_THRESHOLD`          Threshold used for high image-match
classification.
`CLOUDINARY_CLOUD_NAME`             Cloudinary cloud name.
`CLOUDINARY_API_KEY`                Cloudinary API key.
`CLOUDINARY_API_SECRET`             Cloudinary API secret.
`SMTP_HOST`                         SMTP server hostname.
`SMTP_PORT`                         SMTP server port.
`SMTP_USER`                         SMTP username.
`SMTP_PASS`                         SMTP password.
`FROM_EMAIL`                        Sender email address.
`FROM_NAME`                         Sender display name.
Example local configuration:
``` env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb://127.0.0.1:27017/lost-and-found
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d

GEMINI_API_KEY=your_gemini_api_key

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```
Email and admin-seeding variables should be configured if those features
are being used. Refer to `backend/.env.example` for the complete
environment template and defaults.
Frontend Environment Variables
---
Variable                Description             Example
---
`VITE_API_BASE_URL`     Backend API base URL.   `http://localhost:5000/api`
---
Security note: Never commit `.env` files, JWT secrets, Gemini API
keys, Cloudinary secrets, SMTP credentials, or admin passwords. Keep
private credentials on the backend.
Running the Application
Run the backend and frontend in separate terminals.
Terminal 1 --- Backend
``` bash
cd backend
npm run dev
```
Terminal 2 --- Frontend
``` bash
cd frontend
npm run dev
```
Make sure MongoDB is running and the required environment variables are
configured. Optional AI, cloud-storage, and email features require their
respective service credentials.
Testing
The backend includes tests for the matching engine.
Run the standard matching service tests:
``` bash
cd backend
npm test
```
Run the hybrid matching integration tests:
``` bash
npm run test:hybrid
```
These tests help validate matching behaviour and the hybrid matching
logic. Refer to the backend package scripts and test files for the exact
test coverage.
Deployment
The project supports separate frontend and backend deployment.
Backend Deployment --- Render
The repository includes a `render.yaml` deployment configuration.
Connect the GitHub repository to Render.
Configure the backend directory as the service root.
Use the start command configured for the backend.
Add the required environment variables, including MongoDB URI and
JWT secret.
Configure optional Gemini, Cloudinary, and SMTP credentials if those
services are enabled.
Set `CLIENT_URL` to the deployed frontend URL.
Frontend Deployment --- Vercel
Import the GitHub repository into Vercel.
Set the project root directory to `frontend`.
Use the Vite build command:
``` bash
npm run build
```
Set the output directory to:
``` text
dist
```
Configure `VITE_API_BASE_URL` to point to the deployed backend API.
Deploy the frontend.
Database --- MongoDB Atlas
A MongoDB Atlas cluster can be used for production database hosting. Set
the Atlas connection string as `MONGO_URI` and configure network access
so the deployed backend can connect securely.
Current Limitations
AI matching quality depends on the quality of the uploaded images
and item descriptions.
Gemini-based features depend on API availability, quotas, and
network connectivity.
A similarity score indicates a potential match, not proof that a
claimant owns an item. Admin verification remains important.
Local image storage is intended as a fallback; persistent cloud
storage is preferable for production deployments.
Email-based OTP recovery depends on valid SMTP provider
configuration.
The current matching queue is an application-level asynchronous
queue. A durable distributed queue and separate worker
infrastructure could improve resilience and scaling for a larger
deployment.
Future Improvements
Possible enhancements include:
Native Android and iOS applications with push notifications.
GPS-based campus maps and location heatmaps.
QR code and NFC tags for personal belongings.
Multi-campus or multi-organization support.
OCR to extract useful text from item images.
Secure in-app messaging between finders and owners.
WhatsApp and SMS notifications for important match updates.
Advanced admin analytics and downloadable reports.
A durable distributed job queue with retry and failure monitoring.
Improved matching evaluation using labelled match and non-match
examples.
Applications
This platform can be used in:
Colleges and universities.
School campuses.
Corporate offices.
Libraries and laboratories.
Hostels and residential campuses.
Event venues and conference centres.
Other communities that need a centralized lost-and-found process.
Author
Developer: Charan Sai
Education: Bachelor of Computer Science & Engineering
Project: Lost & Found Matching Platform
Focus Areas: Full-Stack Web Development, Backend Development,
AI-powered Applications
License
This project is developed for educational and learning purposes. Add a
dedicated LICENSE file if you intend to distribute the project under a
formal open-source license.
