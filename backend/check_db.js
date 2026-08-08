const mongoose = require('mongoose');
const FoundItem = require('./models/FoundItem');
const Claim = require('./models/Claim');
const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to MongoDB');
    const items = await FoundItem.find({ category: /key/i });
    console.log('Found Items:', items.map(i => ({ _id: i._id, category: i.category, status: i.status })));
    
    for (const item of items) {
      const claims = await Claim.find({ foundItem: item._id });
      console.log(`Claims for ${item._id}:`, claims.map(c => ({ _id: c._id, status: c.status })));
      
      const verifiedClaim = claims.find(c => c.status === 'verified');
      if (verifiedClaim && item.status === 'Pending') {
         console.log(`Fixing item ${item._id} to Verified...`);
         item.status = 'Verified';
         await item.save();
      }
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
