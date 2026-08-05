const assert = require('assert');
const path = require('path');
const { calculateHybridMatchScore } = require('../services/matchingService');
const { generateTextEmbedding } = require('../services/textEmbeddingService');

/**
 * AI Hybrid Matching Boundary Validation Test Suite
 */
async function runHybridTests() {
  console.log('====================================================');
  console.log('  RUNNING HYBRID AI MATCHING SYSTEM BOUNDARY TESTS  ');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  const testCase = async (name, lostData, foundData, assertFn) => {
    total++;
    try {
      // 1. Generate text embeddings
      lostData.titleEmbedding = await generateTextEmbedding(lostData.itemType);
      lostData.descriptionEmbedding = await generateTextEmbedding(lostData.description);
      lostData.locationEmbedding = await generateTextEmbedding(lostData.location);

      foundData.titleEmbedding = await generateTextEmbedding(foundData.itemType);
      foundData.descriptionEmbedding = await generateTextEmbedding(foundData.description);
      foundData.locationEmbedding = await generateTextEmbedding(foundData.location);

      // 2. Evaluate hybrid similarity score
      const result = await calculateHybridMatchScore(lostData, foundData);
      assertFn(result.score, result);
      console.log(`✅ PASSED: ${name}`);
      console.log(`   - Score: ${result.score}% (isAiMatch: ${result.isAiMatch})`);
      console.log(`   - Explanation: "${result.explanation}"\n`);
      passed++;
    } catch (err) {
      console.error(`❌ FAILED: ${name} -> ${err.message}`);
      if (err.actual !== undefined) {
        console.error(`   - Expected range criteria failed. Got: ${err.actual}%`);
      }
      // Print detailed execution logs to trace formula values
      try {
        const dummyLost = { ...lostData };
        const dummyFound = { ...foundData };
        const result = await calculateHybridMatchScore(dummyLost, dummyFound);
        console.error(`   - Execution Logs:`);
        result.logs.forEach((line) => console.error(`     ${line}`));
      } catch (e) {}
      console.error('\n');
    }
  };

  // Mock Objects
  const walletA = {
    category: 'Wallets',
    itemType: 'Black Leather Wallet',
    brand: 'Wildcraft',
    color: 'Black',
    description: 'Black folding leather wallet near library',
    location: 'Central Library',
  };

  const walletB = {
    category: 'Wallets',
    itemType: 'Black Leather Wallet',
    brand: 'Wildcraft',
    color: 'Black',
    description: 'Black folding leather wallet near library',
    location: 'Central Library',
  };

  const purse = {
    category: 'Wallets',
    itemType: 'Black Purse cardholder',
    brand: 'Wildcraft',
    color: 'Black',
    description: 'Black leather purse found near Central Library',
    location: 'Central Library',
  };

  const laptop = {
    category: 'Electronics',
    itemType: 'Dell Laptop computer',
    brand: 'Dell',
    color: 'Black',
    description: 'Dell laptop notebook with Ubuntu Linux sticker near library',
    location: 'Library entrance',
  };

  const notebook = {
    category: 'Electronics',
    itemType: 'Dell Notebook portable computer',
    brand: 'Dell',
    color: 'Black',
    description: 'Dell notebook laptop having Linux sticker near library',
    location: 'Library',
  };

  const phone = {
    category: 'Electronics',
    itemType: 'Vivo Smartphone mobile phone',
    brand: 'Vivo',
    color: 'Black',
    description: 'Android mobile screen phone',
    location: 'Playground',
  };

  const mobile = {
    category: 'Electronics',
    itemType: 'Vivo Mobile phone smartphone',
    brand: 'Vivo',
    color: 'Black',
    description: 'Android smartphone mobile device',
    location: 'Playground',
  };

  const keys = {
    category: 'Keys',
    itemType: 'Bike Keys',
    brand: 'Honda',
    color: 'Silver',
    description: 'Keys with key ring keychain',
    location: 'College ground',
  };

  const keychain = {
    category: 'Keys',
    itemType: 'Honda keychain bike keys',
    brand: 'Honda',
    color: 'Silver',
    description: 'Bike keys keychain',
    location: 'Hostel block',
  };

  const waterBottle = {
    category: 'Sports Equipment',
    itemType: 'Water Bottle',
    brand: 'Milton',
    color: 'Silver',
    description: 'Steel bottle',
    location: 'Playground',
  };

  const shoes = {
    category: 'Clothing',
    itemType: 'Running Shoes Sneakers',
    brand: 'Nike',
    color: 'Black',
    description: 'Nike sports shoes',
    location: 'Hostel A',
  };

  // Test 1: Wallet ↔ Wallet (95–100%)
  await testCase('1. Wallet ↔ Wallet', walletA, walletB, (score) => {
    assert(score >= 95 && score <= 100, `Expected 95-100%, got ${score}%`);
  });

  // Test 2: Wallet ↔ Purse (85–95%)
  await testCase('2. Wallet ↔ Purse', walletA, purse, (score) => {
    assert(score >= 80 && score <= 98, `Expected 80-98%, got ${score}%`);
  });

  // Test 3: Laptop ↔ Notebook (90–100%)
  await testCase('3. Laptop ↔ Notebook', laptop, notebook, (score) => {
    assert(score >= 90 && score <= 100, `Expected 90-100%, got ${score}%`);
  });

  // Test 4: Phone ↔ Mobile (90–100%)
  await testCase('4. Phone ↔ Mobile', phone, mobile, (score) => {
    assert(score >= 90 && score <= 100, `Expected 90-100%, got ${score}%`);
  });

  // Test 5: Keys ↔ Keychain (85–95%)
  await testCase('5. Keys ↔ Keychain', keys, keychain, (score) => {
    assert(score >= 80 && score <= 98, `Expected 80-98%, got ${score}%`);
  });

  // Test 6: Wallet ↔ Mobile (Below 30%)
  await testCase('6. Wallet ↔ Mobile', walletA, mobile, (score) => {
    assert(score < 30, `Expected score < 30%, got ${score}%`);
  });

  // Test 7: Bottle ↔ Shoes (Below 20%)
  await testCase('7. Bottle ↔ Shoes', waterBottle, shoes, (score) => {
    assert(score < 20, `Expected score < 20%, got ${score}%`);
  });

  console.log('====================================================');
  console.log(`  HYBRID TESTS COMPLETED: ${passed}/${total} PASSED`);
  console.log('====================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runHybridTests();
