/**
 * createAdmin.js
 *
 * Run this once to create an admin account (or promote an existing user
 * to admin). There is no public "register as admin" endpoint on purpose —
 * admin accounts should be provisioned out-of-band by whoever runs the
 * platform, not self-service.
 *
 * Usage:
 *   node scripts/createAdmin.js "Admin Name" admin@example.com "StrongPassword123"
 */
const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

const run = async () => {
  const [name, email, password] = process.argv.slice(2);

  if (!name || !email || !password) {
    console.error('Usage: node scripts/createAdmin.js "Admin Name" admin@example.com "StrongPassword123"');
    process.exit(1);
  }

  await connectDB();

  let user = await User.findOne({ email: email.toLowerCase() });

  if (user) {
    user.role = 'admin';
    await user.save();
    console.log(`Existing user ${email} promoted to admin.`);
  } else {
    user = await User.create({ name, email, password, role: 'admin' });
    console.log(`Admin user created: ${email}`);
  }

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error('Failed to create admin user:', err.message);
  process.exit(1);
});
