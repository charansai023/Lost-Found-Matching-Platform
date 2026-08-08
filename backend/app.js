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

const app = express();

// --- Global Middleware ---

// Allow requests from our frontend (localhost, configured CLIENT_URL, or Vercel preview domains)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman) or any localhost port
      if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      const clientUrls = (process.env.CLIENT_URL || '')
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean);

      if (clientUrls.includes(origin) || /\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
    },
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
