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
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// --- Global Middleware ---

// Allow requests from our frontend (any localhost port for dev)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl) or any localhost port
      if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
        callback(null, true);
      } else if (origin === (process.env.CLIENT_URL || '')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
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

// --- Error Handling (must be registered last) ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;
