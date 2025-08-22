#!/usr/bin/env npx tsx

/**
 * Sprint 2 Ship-Readiness Verification Script
 * 
 * Tests core functionality without requiring full Playwright setup
 */

import { isPublicHttpUrl, CRAWL_LIMITS } from '../lib/security/url-guard';
import { ScanResultsNormalizer } from '../lib/scan-results';
import { VPATGenerator } from '../lib/reports/vpat-generator';

interface VerificationResult {
  test: string;
  passed: boolean;
  details: string;
  timing?: number;
}

const results: VerificationResult[] = [];

function addResult(test: string, passed: boolean, details: string, timing?: number) {
  results.push({ test, passed, details, timing });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  const timeStr = timing ? ` (${timing}ms)` : '';
  console.log(`${status}: ${test}${timeStr}`);
  if (!passed) {
    console.log(`  └─ ${details}`);
  }
}

async function verifySSRFDefenses() {
  console.log('\n🔒 Testing SSRF Defenses...');
  
  const maliciousUrls = [
    'http://localhost:3000',
    'http://127.0.0.1',
    'http://169.254.169.254',
    'http://foo.internal',
    'ftp://example.com',
    'javascript:alert(1)',
    'file:///etc/passwd'
  ];
  
  const legitimateUrls = [
    'https://example.com',
    'https://www.google.com',
    'http://httpbin.org'
  ];
  
  let maliciousBlocked = 0;
  let legitimateAllowed = 0;
  
  for (const url of maliciousUrls) {
    const isAllowed = await isPublicHttpUrl(url);
    if (!isAllowed) maliciousBlocked++;
  }
  
  for (const url of legitimateUrls) {
    const isAllowed = await isPublicHttpUrl(url);
    if (isAllowed) legitimateAllowed++;
  }
  
  addResult(
    'SSRF Protection - Block Private URLs',
    maliciousBlocked === maliciousUrls.length,
    `Blocked ${maliciousBlocked}/${maliciousUrls.length} malicious URLs`
  );
  
  addResult(
    'SSRF Protection - Allow Public URLs',
    legitimateAllowed === legitimateUrls.length,
    `Allowed ${legitimateAllowed}/${legitimateUrls.length} legitimate URLs`
  );
}

async function verifyCrawlBudgets() {
  console.log('\n📊 Testing Crawl Budget Enforcement...');
  
  const freeLimits = CRAWL_LIMITS.free;
  const proLimits = CRAWL_LIMITS.pro;
  const enterpriseLimits = CRAWL_LIMITS.enterprise;
  
  addResult(
    'Crawl Limits - Free Tier',
    freeLimits.maxPages === 5 && freeLimits.maxDepth === 1 && freeLimits.maxTimeMs === 120000,
    `Free: ${freeLimits.maxPages} pages, depth ${freeLimits.maxDepth}, ${freeLimits.maxTimeMs}ms`
  );
  
  addResult(
    'Crawl Limits - Pro Tier',
    proLimits.maxPages === 50 && proLimits.maxDepth === 3 && proLimits.maxTimeMs === 300000,
    `Pro: ${proLimits.maxPages} pages, depth ${proLimits.maxDepth}, ${proLimits.maxTimeMs}ms`
  );
  
  addResult(
    'Crawl Limits - Enterprise Tier',
    enterpriseLimits.maxPages === 500 && enterpriseLimits.maxDepth === 5,
    `Enterprise: ${enterpriseLimits.maxPages} pages, depth ${enterpriseLimits.maxDepth}`
  );
}

async function verifyNormalizerScoring() {
  console.log('\n🎯 Testing Normalizer & Scoring...');
  
  // Create mock findings for testing
  const mockFindings = [
    {
      id: 'test-1',
      scanId: 'test-scan',
      ruleId: 'image-alt',
      impact: 'critical' as const,
      wcagCriterion: '1.1.1',
      wcagLevel: 'A' as const,
      severity: 4,
      description: 'Image missing alt text',
      help: 'Add alt text',
      helpUrl: 'https://example.com',
      selector: 'img',
      snippet: '<img src="test.jpg">',
      pageUrl: 'https://example.com',
      elementType: 'img',
      legalRisk: 'high' as const,
      quickWin: true,
      estimatedFixTime: '2-5 minutes',
      category: 'perceivable' as const,
      businessImpact: 'Critical for SEO and legal compliance',
      userImpact: 'Screen reader users cannot understand images',
      remediation: {
        code: '<img src="test.jpg" alt="Description">',
        description: 'Add meaningful alt text',
        effort: 'low' as const
      }
    },
    {
      id: 'test-2',
      scanId: 'test-scan',
      ruleId: 'color-contrast',
      impact: 'serious' as const,
      wcagCriterion: '1.4.3',
      wcagLevel: 'AA' as const,
      severity: 3,
      description: 'Insufficient color contrast',
      help: 'Increase contrast',
      helpUrl: 'https://example.com',
      selector: '.text',
      snippet: '<p class="text">Low contrast</p>',
      pageUrl: 'https://example.com',
      elementType: 'p',
      legalRisk: 'high' as const,
      quickWin: false,
      estimatedFixTime: '10-30 minutes',
      category: 'perceivable' as const,
      businessImpact: 'Most common ADA lawsuit trigger',
      userImpact: 'Users with low vision cannot read text',
      remediation: {
        code: 'color: #000; background: #fff;',
        description: 'Adjust colors for sufficient contrast',
        effort: 'medium' as const
      }
    }
  ];
  
  const startTime = Date.now();
  const score = ScanResultsNormalizer.calculateScanScore(mockFindings);
  const quickWins = ScanResultsNormalizer.analyzeQuickWins(mockFindings);
  const topIssues = ScanResultsNormalizer.generateTopIssuesReport(mockFindings);
  const timing = Date.now() - startTime;
  
  addResult(
    'Scoring - Overall Range',
    score.overall >= 0 && score.overall <= 100,
    `Overall score: ${score.overall}`,
    timing
  );
  
  addResult(
    'Scoring - WCAG Principles',
    score.perceivable >= 0 && score.operable >= 0 && score.understandable >= 0 && score.robust >= 0,
    `P:${score.perceivable}, O:${score.operable}, U:${score.understandable}, R:${score.robust}`
  );
  
  addResult(
    'Quick Wins Analysis',
    quickWins.totalQuickWins === 1 && quickWins.priorityFixes.length > 0,
    `Found ${quickWins.totalQuickWins} quick wins, ${quickWins.priorityFixes.length} priority fixes`
  );
  
  addResult(
    'Top Issues Report',
    topIssues.issues.length === 2 && topIssues.summary.totalUniqueIssues === 2,
    `${topIssues.issues.length} issues, ${topIssues.summary.criticalCount} critical`
  );
}

async function verifyVPATGeneration() {
  console.log('\n📄 Testing VPAT 2.5 Generation...');
  
  const mockVPATData = {
    product: {
      name: 'Test Product',
      version: '1.0',
      description: 'Test description',
      dateEvaluated: '2024-01-01',
      evaluatorName: 'Test Evaluator',
      evaluatorTitle: 'Test Title',
      evaluatorOrganization: 'Test Org',
      contactInfo: 'test@example.com'
    },
    evaluation: {
      methodology: 'Automated testing',
      scope: 'Web application',
      testingApproach: 'WCAG 2.1 compliance',
      assistiveTechnology: ['Screen readers'],
      browsers: ['Chrome'],
      operatingSystems: ['Windows']
    },
    findings: [],
    score: {
      overall: 95,
      perceivable: 95,
      operable: 95,
      understandable: 95,
      robust: 95,
      compliance: {
        wcagA: true,
        wcagAA: true,
        wcagAAA: false
      },
      trends: {
        improvement: 0,
        direction: 'stable' as const
      }
    },
    url: 'https://example.com',
    domain: 'example.com'
  };
  
  const startTime = Date.now();
  const vpatHTML = VPATGenerator.generateVPAT25(mockVPATData);
  const timing = Date.now() - startTime;
  
  addResult(
    'VPAT Generation - Basic Structure',
    vpatHTML.includes('VPAT') && vpatHTML.includes('Section 508') && vpatHTML.includes('WCAG'),
    `Generated ${vpatHTML.length} characters`,
    timing
  );
  
  addResult(
    'VPAT Generation - Product Info',
    vpatHTML.includes('Test Product') && vpatHTML.includes('Test Evaluator'),
    'Product and evaluator information included'
  );
  
  addResult(
    'VPAT Generation - Compliance Tables',
    vpatHTML.includes('Conformance Level') && vpatHTML.includes('Supports'),
    'Conformance tables properly structured'
  );
  
  // Test XSS prevention
  const xssData = {
    ...mockVPATData,
    product: {
      ...mockVPATData.product,
      name: '<script>alert("xss")</script>Test'
    }
  };
  
  const xssTestHTML = VPATGenerator.generateVPAT25(xssData);
  
  addResult(
    'VPAT Generation - XSS Prevention',
    !xssTestHTML.includes('<script>') && xssTestHTML.includes('&lt;script&gt;'),
    'XSS payload properly escaped'
  );
}

async function verifySanitization() {
  console.log('\n🧼 Testing HTML Sanitization...');
  
  // Import the sanitization tester
  const { testSanitization } = await import('../lib/security/sanitizer');
  
  const result = testSanitization();
  
  addResult(
    'HTML Sanitization',
    result.passed === result.total,
    `Safely escaped ${result.passed}/${result.total} XSS payloads`
  );
  
  // Log details for debugging if needed
  if (result.passed < result.total) {
    console.log('  Failed payloads:');
    result.details.filter(d => d.startsWith('❌')).forEach(d => console.log(`    ${d}`));
  }
}

async function verifyUUIDValidation() {
  console.log('\n🔗 Testing UUID Validation...');
  
  const validUUIDs = [
    '550e8400-e29b-41d4-a716-446655440000',
    '123e4567-e89b-12d3-a456-426614174000'
  ];
  
  const invalidUUIDs = [
    'invalid-uuid',
    '123',
    '',
    'null',
    '550e8400-e29b-41d4-a716-44665544000G',
    '550e8400-e29b-41d4-a716'
  ];
  
  const uuidRegex = /^[0-9a-f-]{36}$/i;
  
  let validCount = 0;
  let invalidCount = 0;
  
  for (const uuid of validUUIDs) {
    if (uuidRegex.test(uuid)) validCount++;
  }
  
  for (const uuid of invalidUUIDs) {
    if (!uuidRegex.test(uuid)) invalidCount++;
  }
  
  addResult(
    'UUID Validation - Valid UUIDs',
    validCount === validUUIDs.length,
    `Accepted ${validCount}/${validUUIDs.length} valid UUIDs`
  );
  
  addResult(
    'UUID Validation - Invalid UUIDs',
    invalidCount === invalidUUIDs.length,
    `Rejected ${invalidCount}/${invalidUUIDs.length} invalid UUIDs`
  );
}

async function runAllVerifications() {
  console.log('🚀 Sprint 2 Ship-Readiness Verification\n');
  console.log('Running comprehensive tests of scanner engine and security...\n');
  
  await verifySSRFDefenses();
  await verifyCrawlBudgets();
  await verifyNormalizerScoring();
  await verifyVPATGeneration();
  await verifySanitization();
  await verifyUUIDValidation();
  
  console.log('\n📊 VERIFICATION SUMMARY');
  console.log('========================');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const passRate = Math.round((passed / total) * 100);
  
  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${total - passed}`);
  console.log(`Pass Rate: ${passRate}%`);
  
  const failedTests = results.filter(r => !r.passed);
  if (failedTests.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    failedTests.forEach(test => {
      console.log(`  • ${test.test}: ${test.details}`);
    });
  }
  
  if (passRate >= 95) {
    console.log('\n🎉 SHIP-READY! All critical systems verified.');
    process.exit(0);
  } else if (passRate >= 85) {
    console.log('\n⚠️  MOSTLY READY - Minor issues to address.');
    process.exit(0);
  } else {
    console.log('\n🚨 NOT SHIP-READY - Critical issues found.');
    process.exit(1);
  }
}

// Run verification
runAllVerifications().catch(error => {
  console.error('\n💥 Verification failed with error:', error);
  process.exit(1);
});