/**
 * Test Script for Share Token Functionality
 * 
 * Verifies that the sharing system works correctly
 */

import { newRawToken, hashToken, validateTokenAccess, isValidTokenFormat } from '../lib/share';

interface TestResult {
  test: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function test(name: string, condition: boolean, details?: string) {
  results.push({
    test: name,
    passed: condition,
    details
  });
  
  const status = condition ? '✅' : '❌';
  console.log(`${status} ${name}${details ? ` - ${details}` : ''}`);
}

async function runTests() {
  console.log('🧪 Testing Share Token Security\n');

  // Test 1: Token generation
  const token1 = newRawToken();
  const token2 = newRawToken();
  
  test(
    'Token generation produces unique tokens',
    token1 !== token2,
    `Token 1: ${token1.substring(0, 8)}..., Token 2: ${token2.substring(0, 8)}...`
  );

  // Test 2: Token format validation
  test(
    'Generated tokens have correct format',
    isValidTokenFormat(token1) && isValidTokenFormat(token2),
    `Both tokens are valid base64url, 32 characters`
  );

  test(
    'Invalid formats are rejected',
    !isValidTokenFormat('invalid') && !isValidTokenFormat('too-short') && !isValidTokenFormat(''),
    'Short and invalid strings rejected'
  );

  // Test 3: Token entropy (≥192-bit)
  const tokens = Array.from({ length: 1000 }, () => newRawToken());
  const uniqueTokens = new Set(tokens);
  
  test(
    'Token entropy is sufficient (no collisions in 1000 tokens)',
    uniqueTokens.size === 1000,
    `Generated ${uniqueTokens.size} unique tokens out of 1000`
  );

  // Test 4: Hash consistency
  const rawToken = newRawToken();
  const hash1 = hashToken(rawToken);
  const hash2 = hashToken(rawToken);
  
  test(
    'Hash function is deterministic',
    Buffer.compare(hash1, hash2) === 0,
    'Same input produces same hash'
  );

  test(
    'Different inputs produce different hashes',
    Buffer.compare(hashToken('test1'), hashToken('test2')) !== 0,
    'Hash collision resistance'
  );

  // Test 5: Token validation
  const mockToken = {
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    revoked_at: null,
    views: 5,
    max_views: 100,
    token_hash: hashToken(rawToken)
  };

  const validResult = validateTokenAccess(mockToken, rawToken);
  test(
    'Valid token passes validation',
    validResult.valid && !validResult.reason,
    'Active token with remaining views is valid'
  );

  // Test 6: Expired token rejection
  const expiredToken = {
    ...mockToken,
    expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
  };

  const expiredResult = validateTokenAccess(expiredToken, rawToken);
  test(
    'Expired token is rejected',
    !expiredResult.valid && expiredResult.reason === 'expired',
    'Expired tokens are properly rejected'
  );

  // Test 7: Revoked token rejection
  const revokedToken = {
    ...mockToken,
    revoked_at: new Date()
  };

  const revokedResult = validateTokenAccess(revokedToken, rawToken);
  test(
    'Revoked token is rejected',
    !revokedResult.valid && revokedResult.reason === 'revoked',
    'Revoked tokens are properly rejected'
  );

  // Test 8: View limit enforcement
  const viewLimitToken = {
    ...mockToken,
    views: 100,
    max_views: 100
  };

  const viewLimitResult = validateTokenAccess(viewLimitToken, rawToken);
  test(
    'View limit is enforced',
    !viewLimitResult.valid && viewLimitResult.reason === 'view_limit_exceeded',
    'Tokens at view limit are rejected'
  );

  // Test 9: Wrong token rejection
  const wrongTokenResult = validateTokenAccess(mockToken, newRawToken());
  test(
    'Wrong token is rejected',
    !wrongTokenResult.valid && wrongTokenResult.reason === 'hash_mismatch',
    'Incorrect tokens are rejected'
  );

  // Test 10: URL generation safety
  const testTokens = Array.from({ length: 100 }, () => newRawToken());
  const allUrlSafe = testTokens.every(token => {
    // Check if token contains only URL-safe characters
    return /^[A-Za-z0-9_-]+$/.test(token);
  });

  test(
    'Generated tokens are URL-safe',
    allUrlSafe,
    'All tokens use only base64url characters'
  );

  // Summary
  console.log('\n📊 Test Summary:');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  console.log(`Passed: ${passed}/${total} tests`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Share token security is properly implemented.');
  } else {
    console.log('⚠️  Some tests failed. Review implementation before deploying.');
    
    const failed = results.filter(r => !r.passed);
    console.log('\nFailed tests:');
    failed.forEach(test => {
      console.log(`  - ${test.test}${test.details ? ` (${test.details})` : ''}`);
    });
  }

  return passed === total;
}

// API endpoint test helpers
export function testAPIEndpoints() {
  console.log('\n🌐 API Endpoint Tests (Manual):');
  console.log('Run these tests manually against your running server:\n');
  
  console.log('1. Create share token:');
  console.log(`curl -X POST http://localhost:3000/api/reports/share \\
  -H "Content-Type: application/json" \\
  -d '{"scanId": "test-scan-id", "ttlDays": 7, "maxViews": 50}'`);
  
  console.log('\n2. Access shared report (replace TOKEN with actual token):');
  console.log('curl http://localhost:3000/r/TOKEN');
  
  console.log('\n3. Revoke share token (replace TOKEN_ID with actual ID):');
  console.log(`curl -X POST http://localhost:3000/api/reports/revoke \\
  -H "Content-Type: application/json" \\
  -d '{"tokenId": "TOKEN_ID"}'`);
  
  console.log('\n4. Test invalid/expired token:');
  console.log('curl http://localhost:3000/r/invalid-token-should-404');
  
  console.log('\n5. Test PDF download with token:');
  console.log('curl "http://localhost:3000/api/reports/SCAN_ID/pdf?t=TOKEN"');
}

// Run tests if script is executed directly
if (require.main === module) {
  runTests().then(success => {
    testAPIEndpoints();
    process.exit(success ? 0 : 1);
  });
}

export { runTests };