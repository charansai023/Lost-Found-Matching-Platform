const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const lostItemRoutes = require('./routes/lostItemRoutes');
const foundItemRoutes = require('./routes/foundItemRoutes');
const matchRoutes = require('./routes/matchRoutes');
const myRoutes = require('./routes/myRoutes');
const adminRoutes = require('./routes/adminRoutes');
const claimRoutes = require('./routes/claimRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const rewardRoutes = require('./routes/rewardRoutes');
const adminRewardRoutes = require('./routes/adminRewardRoutes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
// Phase 1: single shared CORS origin policy (also used by Socket.IO).
const { corsOriginHandler } = require('./config/corsOrigins');
const app = express();
// --- Global Middleware ---
// Allow requests from our exact production frontend, localhost development
// origins, or any origin configured in CLIENT_URL. Arbitrary *.vercel.app
// deployments are no longer accepted (phishing surface removed).
app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true,
  })
);

// Parse incoming JSON request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically so the frontend can display them
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Routes ---

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is running', data: {} });
});

app.use('/api/auth', authRoutes);
app.use('/api/lost', lostItemRoutes);
app.use('/api/found', foundItemRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/my', myRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/admin/rewards', adminRewardRoutes);

// --- Error Handling (must be registered last) ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;
