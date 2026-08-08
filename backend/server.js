const dotenv = require('dotenv');
dotenv.config();

if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';
const __env = process.env.NODE_ENV.toLowerCase();

const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./services/socketService');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
initSocket(server);

// Connect to the database, then start the server
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT} [NODE_ENV=${__env}]`);
    if (__env === 'development') {
      console.log('🔧  Development mode: Forgot Password OTP will be printed to terminal (email skipped)');
    }
  });
});
