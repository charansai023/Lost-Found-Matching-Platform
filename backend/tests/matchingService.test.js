const assert = require('assert');
const path = require('path');
const { calculateMatchScoreAsync, evaluateCategoryCompatibility } = require('../services/matchingService');

/**
 * Unit Test Suite for AI Matching System & Category Validation Rules
 */
async function runUnitTests() {
  console.log('====================================================');
  console.log('  RUNNING AI MATCHING SYSTEM UNIT TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  const testCase = async (name, lostItem, foundItem, assertFn) => {
    total++;
    try {
      const result = await calculateMatchScoreAsync(lostItem, foundItem);
      assertFn(result.score, result);
      console.log(`✅ PASSED: ${name} -> Score: ${result.score}% (Level: ${result.matchLevel})`);
      passed++;
    } catch (err) {
      console.error(`❌ FAILED: ${name} -> ${err.message}`);
    }
  };

  // Mock items
  const walletA = {
    category: 'Wallets',
    itemType: 'Black Leather Wallet',
    brand: 'Wildcraft',
    color: 'Black',
    description: 'Black bi-fold leather wallet lost near library',
  };

  const walletB = {
    category: 'Wallets',
    itemType: 'Black Leather Wallet',
    brand: 'Wildcraft',
    color: 'Black',
    description: 'Black leather wallet found near library',
  };

  const walletC = {
    category: 'Wallets',
    itemType: 'Brown Leather Cardholder Wallet',
    brand: 'Tommy Hilfiger',
    color: 'Brown',
    description: 'Brown leather cardholder wallet',
  };

  const mobileA = {
    category: 'Electronics',
    itemType: 'Vivo Mobile Smartphone',
    brand: 'Vivo',
    color: 'Black',
    description: 'Black Android smartphone with glass back',
  };

  const mobileB = {
    category: 'Electronics',
    itemType: 'Vivo Smartphone',
    brand: 'Vivo',
    color: 'Black',
    description: 'Black smartphone found at ground',
  };

  const laptop = {
    category: 'Electronics',
    itemType: 'MacBook Pro Laptop',
    brand: 'Apple',
    color: 'Silver',
    description: '16 inch silver laptop',
  };

  const waterBottle = {
    category: 'Sports Equipment',
    itemType: 'Stainless Steel Water Bottle',
    brand: 'Milton',
    color: 'Silver',
    description: 'Hydration flask bottle',
  };

  const keysA = {
    category: 'Keys',
    itemType: 'Bike Keys Keychain',
    brand: 'Honda',
    color: 'Black',
    description: 'Keys with Honda key ring',
  };

  const keysB = {
    category: 'Keys',
    itemType: 'Keychain Keys',
    brand: 'Honda',
    color: 'Black',
    description: 'Set of bike keys',
  };

  const shoes = {
    category: 'Clothing',
    itemType: 'Running Shoes',
    brand: 'Nike',
    color: 'Black',
    description: 'Black sport sneakers',
  };

  // 1. Wallet vs Wallet -> 90-100%
  await testCase('1. Wallet vs Wallet', walletA, walletB, (score) => {
    assert(score >= 90 && score <= 100, `Expected 90-100%, got ${score}%`);
  });

  // 2. Wallet vs Different Wallet -> 50-95%
  await testCase('2. Wallet vs Different Wallet', walletA, walletC, (score) => {
    assert(score >= 50 && score <= 95, `Expected 50-95%, got ${score}%`);
  });

  // 3. Wallet vs Mobile Phone -> below 30%
  await testCase('3. Wallet vs Mobile Phone', walletA, mobileA, (score) => {
    assert(score < 30, `Expected score < 30%, got ${score}%`);
  });

  // 4. Wallet vs Laptop -> below 20%
  await testCase('4. Wallet vs Laptop', walletA, laptop, (score) => {
    assert(score < 20, `Expected score < 20%, got ${score}%`);
  });

  // 5. Wallet vs Water Bottle -> below 15%
  await testCase('5. Wallet vs Water Bottle', walletA, waterBottle, (score) => {
    assert(score < 15, `Expected score < 15%, got ${score}%`);
  });

  // 6. Mobile vs Mobile -> above 80%
  await testCase('6. Mobile vs Mobile', mobileA, mobileB, (score) => {
    assert(score >= 80, `Expected score >= 80%, got ${score}%`);
  });

  // 7. Keys vs Keys -> above 80%
  await testCase('7. Keys vs Keys', keysA, keysB, (score) => {
    assert(score >= 80, `Expected score >= 80%, got ${score}%`);
  });

  // 8. Keys vs Shoes -> below 15%
  await testCase('8. Keys vs Shoes', keysA, shoes, (score) => {
    assert(score < 15, `Expected score < 15%, got ${score}%`);
  });

  console.log('\n====================================================');
  console.log(`  UNIT TESTS COMPLETE: ${passed}/${total} PASSED`);
  console.log('====================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runUnitTests();
