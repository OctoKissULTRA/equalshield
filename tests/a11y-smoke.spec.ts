import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { ScanResultsNormalizer } from '@/lib/scan-results';

test.describe('Accessibility Engine Smoke Tests', () => {
  
  test('axe core tags run cleanly with all WCAG coverage', async ({ page }) => {
    // Create a clean test page
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Clean Test Page</title>
      </head>
      <body>
        <main>
          <h1>Test Page</h1>
          <p>This page should have no accessibility violations.</p>
          <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwZiIvPjwvc3ZnPg==" alt="Blue square test image" />
          <button type="button">Accessible Button</button>
        </main>
      </body>
      </html>
    `);
    
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    
    // Should have no violations on clean page
    expect(axeResults.violations.length).toBe(0);
    
    // Verify all expected tags are supported
    const allRules = axeResults.passes.concat(axeResults.violations, axeResults.inapplicable);
    const wcagRules = allRules.filter(rule => 
      rule.tags.some(tag => ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'].includes(tag))
    );
    
    expect(wcagRules.length).toBeGreaterThan(50); // Should find substantial WCAG rule coverage
  });

  test('normalizer detects and prioritizes classic issues', async ({ page }) => {
    // Create a page with known accessibility violations
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bad Accessibility Page</title>
        <style>
          .low-contrast { color: #ccc; background: #fff; }
          .hidden-focus { outline: none; }
        </style>
      </head>
      <body>
        <!-- Missing alt text -->
        <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwZiIvPjwvc3ZnPg==" />
        
        <!-- Unlabeled form input -->
        <input type="text" placeholder="Enter your name" />
        
        <!-- Low contrast text -->
        <p class="low-contrast">This text has poor contrast</p>
        
        <!-- Missing button text -->
        <button class="hidden-focus"></button>
        
        <!-- Wrong heading order -->
        <h1>Main Title</h1>
        <h3>Skipped H2</h3>
        
        <!-- Link without text -->
        <a href="/test"></a>
      </body>
      </html>
    `);
    
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    
    expect(axeResults.violations.length).toBeGreaterThan(0);
    
    // Test our normalizer
    const normalized = ScanResultsNormalizer.normalizeAxeResults(axeResults, 'test-scan', 'http://localhost/test');
    
    expect(normalized.length).toBeGreaterThan(0);
    
    // Should detect high-priority issues
    const highPriorityRules = ['image-alt', 'label', 'color-contrast', 'button-name', 'link-name'];
    const foundRules = normalized.map(f => f.ruleId);
    const hasHighPriorityIssue = highPriorityRules.some(rule => foundRules.includes(rule));
    
    expect(hasHighPriorityIssue).toBe(true);
    
    // Test scoring
    const score = ScanResultsNormalizer.calculateScanScore(normalized);
    expect(score.overall).toBeLessThan(90); // Should detect issues
    expect(score.overall).toBeGreaterThanOrEqual(0);
    
    // Test quick wins analysis
    const quickWins = ScanResultsNormalizer.analyzeQuickWins(normalized);
    expect(quickWins.totalQuickWins).toBeGreaterThan(0);
    expect(quickWins.priorityFixes.length).toBeGreaterThan(0);
    
    // Test top issues report
    const topIssues = ScanResultsNormalizer.generateTopIssuesReport(normalized);
    expect(topIssues.issues.length).toBeGreaterThan(0);
    expect(topIssues.issues[0]).toHaveProperty('rule');
    expect(topIssues.issues[0]).toHaveProperty('wcag');
    expect(topIssues.issues[0]).toHaveProperty('legalRisk');
  });

  test('WCAG principle scoring distributes correctly', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <!-- Perceivable issues -->
        <img src="test.jpg" />
        <p style="color: #ccc; background: #fff;">Low contrast</p>
        
        <!-- Operable issues -->
        <div onclick="alert('click')" tabindex="0">Fake button</div>
        
        <!-- Understandable issues -->
        <input type="text" />
        
        <!-- Robust issues -->
        <div role="button">No name</div>
      </body>
      </html>
    `);
    
    const axeResults = await new AxeBuilder({ page }).analyze();
    const normalized = ScanResultsNormalizer.normalizeAxeResults(axeResults, 'test-scan', 'http://localhost/test');
    const score = ScanResultsNormalizer.calculateScanScore(normalized);
    
    // All principle scores should be present and reasonable
    expect(score.perceivable).toBeGreaterThanOrEqual(0);
    expect(score.perceivable).toBeLessThanOrEqual(100);
    expect(score.operable).toBeGreaterThanOrEqual(0);
    expect(score.operable).toBeLessThanOrEqual(100);
    expect(score.understandable).toBeGreaterThanOrEqual(0);
    expect(score.understandable).toBeLessThanOrEqual(100);
    expect(score.robust).toBeGreaterThanOrEqual(0);
    expect(score.robust).toBeLessThanOrEqual(100);
    
    // Overall should be average of principles
    const expectedOverall = Math.round((score.perceivable + score.operable + score.understandable + score.robust) / 4);
    expect(score.overall).toBe(expectedOverall);
  });

  test('scanner handles malformed HTML gracefully', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <div>Unclosed div
        <p>Paragraph without closing
        <img src="test.jpg" alt="Good alt text">
        <button>Good button</button>
      </body>
      </html>
    `);
    
    // Should not throw despite malformed HTML
    const axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults).toBeDefined();
    
    const normalized = ScanResultsNormalizer.normalizeAxeResults(axeResults, 'test-scan', 'http://localhost/test');
    expect(Array.isArray(normalized)).toBe(true);
    
    // Should still detect issues if present
    if (axeResults.violations.length > 0) {
      expect(normalized.length).toBeGreaterThan(0);
    }
  });

  test('legal risk assessment accuracy', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <!-- High legal risk: missing alt text -->
        <img src="important.jpg" />
        
        <!-- High legal risk: form without label -->
        <input type="email" placeholder="Email" required />
        
        <!-- Medium legal risk: heading order -->
        <h1>Title</h1>
        <h3>Wrong level</h3>
      </body>
      </html>
    `);
    
    const axeResults = await new AxeBuilder({ page }).analyze();
    const normalized = ScanResultsNormalizer.normalizeAxeResults(axeResults, 'test-scan', 'http://localhost/test');
    
    const highRiskIssues = normalized.filter(f => f.legalRisk === 'high');
    const mediumRiskIssues = normalized.filter(f => f.legalRisk === 'medium');
    
    // Should identify high-risk patterns
    expect(highRiskIssues.length).toBeGreaterThan(0);
    
    // Quick wins should be properly identified
    const quickWinIssues = normalized.filter(f => f.quickWin === true);
    expect(quickWinIssues.length).toBeGreaterThan(0);
    
    // Business impact should be meaningful
    normalized.forEach(finding => {
      expect(finding.businessImpact).toBeDefined();
      expect(finding.businessImpact.length).toBeGreaterThan(10);
      expect(finding.userImpact).toBeDefined();
      expect(finding.userImpact.length).toBeGreaterThan(10);
    });
  });
});