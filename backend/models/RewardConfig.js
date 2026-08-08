const mongoose = require('mongoose');

const rewardConfigSchema = new mongoose.Schema({
  // Since there should be only one config doc, we can use a singleton approach or just a key.
  singletonKey: {
    type: String,
    default: 'global_config',
    unique: true,
  },
  pointValues: {
    type: Map,
    of: Number,
    default: {
      'ID Card': 40,
      'Keys': 30,
      'Wallet': 100,
      'Mobile': 120,
      'Laptop': 150,
      'Others': 50,
    }
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('RewardConfig', rewardConfigSchema);
