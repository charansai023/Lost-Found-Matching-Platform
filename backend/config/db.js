const mongoose = require('mongoose');

// Connects to MongoDB using the connection string from environment variables
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    // Exit the process if we cannot connect to the database
    process.exit(1);
  }
};

module.exports = connectDB;
