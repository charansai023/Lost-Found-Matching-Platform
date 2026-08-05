const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

/**
 * Reusable Admin Seeder & Password Reset Script
 * 
 * Usage:
 *   Standard Mode (Idempotent):
 *     npm run seed:admin
 *   Password Reset Mode:
 *     npm run seed:admin -- --reset
 */
const seedAdmin = async () => {
  console.log('====================================================');
  console.log('  CAMPUS LOST & FOUND - ADMIN SEEDER SERVICE');
  console.log('====================================================');

  // Step 1: Read Configuration from Environment Variables
  const adminName = process.env.ADMIN_NAME || 'Administrator';
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@campus.com').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lost-and-found';

  const isResetMode = process.argv.includes('--reset');

  console.log(`[Step 1/4] Loaded Environment Config:`);
  console.log(`  - Target Admin Email: ${adminEmail}`);
  console.log(`  - Target Admin Name:  ${adminName}`);
  console.log(`  - Reset Mode:         ${isResetMode ? 'ENABLED (--reset)' : 'DISABLED'}`);

  // Step 2: Connect to MongoDB Database
  console.log(`[Step 2/4] Connecting to MongoDB at ${mongoUri}...`);
  await mongoose.connect(mongoUri);
  console.log('  - Database connection established successfully.');

  // Step 3: Check Existing Admin Account
  console.log(`[Step 3/4] Checking existing admin records in database...`);
  let existingAdmin = await User.findOne({ email: adminEmail });

  if (!existingAdmin) {
    // Also check if any account with role === 'admin' exists
    existingAdmin = await User.findOne({ role: 'admin' });
  }

  if (isResetMode) {
    // Reset Password Mode
    if (existingAdmin) {
      console.log(`  - Located existing admin account (${existingAdmin.email}). Updating password...`);
      existingAdmin.password = adminPassword;
      // Mark profile as completed for admin convenience
      existingAdmin.profileCompleted = true;
      await existingAdmin.save();
      console.log(`\n✅ Admin password reset successfully for: ${existingAdmin.email}`);
    } else {
      console.log(`  - No existing admin found to reset. Creating new admin account...`);
      const newAdmin = new User({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        profileCompleted: true,
      });
      await newAdmin.save();
      console.log(`\nDefault admin created successfully.`);
    }
  } else {
    // Standard Mode (Idempotent creation)
    if (existingAdmin) {
      console.log(`\nAdmin account already exists.`);
      console.log(`  - Existing Admin Email: ${existingAdmin.email}`);
      console.log(`  - Existing Admin Role:  ${existingAdmin.role}`);
      console.log(`  (To reset password, run: npm run seed:admin -- --reset)`);
    } else {
      console.log(`  - No existing admin account found. Creating default admin...`);
      const newAdmin = new User({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        profileCompleted: true,
      });
      await newAdmin.save();
      console.log(`\nDefault admin created successfully.`);
    }
  }

  // Step 4: Disconnect Database Cleanly
  console.log(`\n[Step 4/4] Closing database connection...`);
  await mongoose.connection.close();
  console.log('====================================================');
  console.log('  ADMIN SEEDER OPERATION COMPLETE');
  console.log('====================================================');
  process.exit(0);
};

seedAdmin().catch((err) => {
  console.error('\n❌ Admin Seeder Error:', err.message);
  if (mongoose.connection.readyState !== 0) {
    mongoose.connection.close();
  }
  process.exit(1);
});
