const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { recalculateAllMatches } = require('../services/asyncMatchingQueue');

async function runRecalculation() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lost-and-found';
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);

    console.log('Running recalculation of all database matches...');
    await recalculateAllMatches();

    console.log('Database match recalculation finished successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Recalculation error:', err.message);
    process.exit(1);
  }
}

runRecalculation();
