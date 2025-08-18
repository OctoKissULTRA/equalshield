import puppeteer from 'puppeteer';
import { AxePuppeteer } from '@axe-core/puppeteer';

export interface ScanResult {
  url: string;
  overallScore: number;
  wcagLevel: string;
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
  categories: {
    name: string;
    score: number;
    issues: number;
  }[];
  topIssues: {
    criterion: string;
    level: string;
    impact: string;
    instances: number;
    description: string;
  }[];
  results: any;
}

export async function scanWebsite(url: string): Promise<ScanResult> {
  let browser;
  
  try {
    // Launch Puppeteer browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ]
    });

    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Navigate to the URL
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait for page to be fully loaded
    await page.waitForTimeout(2000);

    // Run axe-core accessibility tests
    const axe = new AxePuppeteer(page);
    const results = await axe
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'section508'])
      .analyze();

    // Process results and calculate scores
    const processedResults = processAxeResults(results);

    return {
      url,
      ...processedResults,
      results: results
    };

  } catch (error) {
    console.error('Scanning error:', error);
    throw new Error(`Failed to scan website: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function processAxeResults(results: any): Omit<ScanResult, 'url' | 'results'> {
  const violations = results.violations || [];
  const passes = results.passes || [];
  const incomplete = results.incomplete || [];

  // Count issues by impact level
  let criticalIssues = 0;
  let majorIssues = 0;
  let minorIssues = 0;

  violations.forEach((violation: any) => {
    const nodeCount = violation.nodes?.length || 1;
    
    switch (violation.impact) {
      case 'critical':
        criticalIssues += nodeCount;
        break;
      case 'serious':
        majorIssues += nodeCount;
        break;
      case 'moderate':
      case 'minor':
        minorIssues += nodeCount;
        break;
    }
  });

  // Calculate overall score (simplified algorithm)
  const totalTests = violations.length + passes.length + incomplete.length;
  const passedTests = passes.length;
  const overallScore = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  // Determine WCAG level
  const wcagLevel = criticalIssues === 0 && majorIssues === 0 
    ? 'Conformant' 
    : criticalIssues === 0 
      ? 'Partial Conformance' 
      : 'Non-Conformant';

  // Calculate POUR principle scores
  const categories = [
    { name: 'Perceivable', score: calculateCategoryScore(violations, ['color-contrast', 'image-alt', 'audio-caption']), issues: 0 },
    { name: 'Operable', score: calculateCategoryScore(violations, ['keyboard', 'focus', 'timing']), issues: 0 },
    { name: 'Understandable', score: calculateCategoryScore(violations, ['lang', 'label', 'error']), issues: 0 },
    { name: 'Robust', score: calculateCategoryScore(violations, ['valid-markup', 'aria']), issues: 0 }
  ];

  // Extract top issues
  const topIssues = violations
    .slice(0, 4)
    .map((violation: any) => ({
      criterion: violation.id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      level: getWCAGLevel(violation.tags),
      impact: violation.impact === 'serious' ? 'Major' : 
              violation.impact === 'critical' ? 'Critical' : 'Minor',
      instances: violation.nodes?.length || 1,
      description: violation.description || violation.help
    }));

  return {
    overallScore,
    wcagLevel,
    criticalIssues,
    majorIssues,
    minorIssues,
    categories,
    topIssues
  };
}

function calculateCategoryScore(violations: any[], keywords: string[]): number {
  const categoryViolations = violations.filter((v: any) => 
    keywords.some(keyword => v.id.includes(keyword))
  );
  
  // Simple scoring: fewer violations = higher score
  const maxScore = 100;
  const penalty = categoryViolations.length * 5;
  return Math.max(maxScore - penalty, 0);
}

function getWCAGLevel(tags: string[]): string {
  if (tags.includes('wcag2aaa') || tags.includes('wcag21aaa')) return 'AAA';
  if (tags.includes('wcag2aa') || tags.includes('wcag21aa')) return 'AA';
  if (tags.includes('wcag2a') || tags.includes('wcag21a')) return 'A';
  return 'Unknown';
}

export async function generateComplianceReport(scanResult: ScanResult): Promise<Buffer> {
  // This would generate a PDF report using jsPDF
  // For now, return a placeholder
  return Buffer.from('PDF report placeholder');
}