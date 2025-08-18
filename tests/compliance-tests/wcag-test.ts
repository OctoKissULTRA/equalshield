import { test, expect, chromium } from '@playwright/test';
import { ComplianceScanner } from '../../src/scanner/engine';
import { LLMComplianceAnalyzer } from '../../src/analyzer/llm-analyzer';

test.describe('WCAG Compliance Detection', () => {
  let scanner: ComplianceScanner;
  let analyzer: LLMComplianceAnalyzer;

  test.beforeEach(() => {
    scanner = new ComplianceScanner();
    analyzer = new LLMComplianceAnalyzer();
  });

  test.describe('Critical WCAG Violations', () => {
    test('detects missing alt text on images', async () => {
      // Create test page with missing alt text
      const testPage = `
        <!DOCTYPE html>
        <html lang="en">
        <head><title>Alt Text Test</title></head>
        <body>
          <h1>Image Accessibility Test</h1>
          <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDAiLz48L3N2Zz4=" />
          <img src="decorative.jpg" alt="" role="presentation" />
          <img src="informative.jpg" alt="A person reading a book" />
        </body>
        </html>
      `;
      
      const browser = await chromium.launch();
      const page = await browser.newPage();
      await page.setContent(testPage);
      
      const result = await scanner.scanWebsite({
        url: 'data:text/html;charset=utf-8,' + encodeURIComponent(testPage),
        depth: 'surface',
        wcagLevel: 'AA'
      });

      const altTextViolations = result.violations.filter(v => 
        v.rule.includes('1.1.1') && v.severity === 'critical'
      );
      
      expect(altTextViolations.length).toBeGreaterThan(0);
      expect(altTextViolations[0].message).toContain('alternative text');
      
      await browser.close();
    });

    test('detects insufficient color contrast', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <title>Contrast Test</title>
          <style>
            .low-contrast { color: #aaa; background-color: #fff; }
            .good-contrast { color: #000; background-color: #fff; }
          </style>
        </head>
        <body>
          <p class="low-contrast">This text has poor contrast</p>
          <p class="good-contrast">This text has good contrast</p>
        </body>
        </html>
      `;

      const result = await scanner.scanWebsite({
        url: 'data:text/html;charset=utf-8,' + encodeURIComponent(testPage),
        depth: 'surface',
        wcagLevel: 'AA'
      });

      const contrastViolations = result.violations.filter(v => 
        v.rule.includes('1.4.3')
      );
      
      expect(contrastViolations.length).toBeGreaterThan(0);
      expect(contrastViolations[0].message).toContain('contrast ratio');
    });

    test('detects keyboard accessibility issues', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html lang="en">
        <head><title>Keyboard Test</title></head>
        <body>
          <div onclick="alert('clicked')" style="cursor: pointer;">Click me (not keyboard accessible)</div>
          <button onclick="alert('clicked')">Keyboard accessible button</button>
          <div tabindex="0" onclick="alert('clicked')" onkeydown="if(event.key==='Enter') alert('clicked')">
            Keyboard accessible div
          </div>
        </body>
        </html>
      `;

      const result = await scanner.scanWebsite({
        url: 'data:text/html;charset=utf-8,' + encodeURIComponent(testPage),
        depth: 'interactive',
        wcagLevel: 'AA'
      });

      const keyboardViolations = result.violations.filter(v => 
        v.rule.includes('2.1.1')
      );
      
      expect(keyboardViolations.length).toBeGreaterThan(0);
      expect(keyboardViolations[0].legalRisk).toBe('high');
    });

    test('detects form labeling issues', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html lang="en">
        <head><title>Form Test</title></head>
        <body>
          <form>
            <!-- Missing label -->
            <input type="email" placeholder="Enter email">
            
            <!-- Proper label -->
            <label for="password">Password:</label>
            <input type="password" id="password">
            
            <!-- Aria-label -->
            <input type="text" aria-label="Search query">
            
            <!-- Placeholder only (problematic) -->
            <input type="tel" placeholder="Phone number">
          </form>
        </body>
        </html>
      `;

      const result = await scanner.scanWebsite({
        url: 'data:text/html;charset=utf-8,' + encodeURIComponent(testPage),
        depth: 'surface',
        wcagLevel: 'AA'
      });

      const labelViolations = result.violations.filter(v => 
        v.rule.includes('3.3.2') && v.severity === 'serious'
      );
      
      expect(labelViolations.length).toBeGreaterThan(0);
    });

    test('detects vague link text', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html lang="en">
        <head><title>Link Test</title></head>
        <body>
          <a href="/page1">Click here</a>
          <a href="/page2">Read more</a>
          <a href="/page3">Learn about our accessibility features</a>
          <a href="/page4"></a> <!-- Empty link -->
        </body>
        </html>
      `;

      const result = await scanner.scanWebsite({
        url: 'data:text/html;charset=utf-8,' + encodeURIComponent(testPage),
        depth: 'surface',
        wcagLevel: 'AA'
      });

      const linkViolations = result.violations.filter(v => 
        v.rule.includes('2.4.4')
      );
      
      expect(linkViolations.length).toBeGreaterThan(0);
      expect(linkViolations.some(v => v.message.includes('vague'))).toBe(true);
    });
  });

  test.describe('Lawsuit Risk Assessment', () => {
    test('identifies high-risk violation patterns', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html>
        <head><title>High Risk Test</title></head>
        <body>
          <!-- Multiple critical violations that commonly appear in lawsuits -->
          <img src="logo.jpg"> <!-- Missing alt -->
          <div onclick="purchase()" style="cursor: pointer; color: #ccc;">Buy Now</div>
          <form>
            <input type="email"> <!-- No label -->
            <input type="submit" value="">  <!-- Empty submit -->
          </form>
          <video src="promo.mp4"></video> <!-- No captions -->
        </body>
        </html>
      `;

      const result = await scanner.scanWebsite({
        url: 'data:text/html;charset=utf-8,' + encodeURIComponent(testPage),
        depth: 'exhaustive',
        wcagLevel: 'AA'
      });

      const riskAssessment = await analyzer.generateLawsuitRiskAssessment(
        result.violations,
        {
          industry: 'E-commerce',
          estimatedRevenue: '$10M-50M',
          userBase: '500K+ users'
        }
      );

      expect(riskAssessment.lawsuitProbability).toBeGreaterThan(60);
      expect(riskAssessment.serialPlaintiffScore).toBeGreaterThan(5);
      expect(riskAssessment.estimatedSettlement.min).toBeGreaterThan(25000);
    });

    test('provides contextual analysis with LLM', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html lang="en">
        <head><title>Context Test</title></head>
        <body>
          <header>
            <img src="logo.png"> <!-- Company logo - critical for brand recognition -->
          </header>
          <main>
            <img src="decorative-pattern.png" role="presentation"> <!-- Decorative - OK -->
            <button onclick="checkout()">
              <img src="cart-icon.png"> <!-- Icon in button - needs alt -->
            </button>
          </main>
        </body>
        </html>
      `;

      const result = await scanner.scanWebsite({
        url: 'data:text/html;charset=utf-8,' + encodeURIComponent(testPage),
        depth: 'surface',
        wcagLevel: 'AA'
      });

      // This would test LLM analysis if API keys are available
      if (process.env.CLAUDE_API_KEY || process.env.OPENAI_API_KEY) {
        const analysis = await analyzer.analyzeForCompliance(
          result.elements,
          result.violations
        );

        expect(analysis.contextualViolations.length).toBeGreaterThan(0);
        expect(analysis.userJourneyBlockers.length).toBeGreaterThan(0);
        
        // Should identify button with icon as high priority
        const buttonViolations = analysis.contextualViolations.filter(v =>
          v.contextReason.includes('button') || v.contextReason.includes('interactive')
        );
        expect(buttonViolations.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Fix Generation', () => {
    test('generates actionable fixes', async () => {
      const testPage = `
        <!DOCTYPE html>
        <html lang="en">
        <head><title>Fix Test</title></head>
        <body>
          <img src="product.jpg" id="product-image">
          <button onclick="addToCart()" id="add-to-cart">Add to Cart</button>
        </body>
        </html>
      `;

      const result = await scanner.scanWebsite({
        url: 'data:text/html;charset=utf-8,' + encodeURIComponent(testPage),
        depth: 'surface',
        wcagLevel: 'AA'
      });

      result.violations.forEach(violation => {
        expect(violation.howToFix).toBeDefined();
        expect(violation.howToFix.length).toBeGreaterThan(0);
        expect(violation.codeExample).toBeDefined();
        expect(violation.codeExample).not.toBe('');
        
        // Code examples should contain actual HTML/CSS, not just comments
        if (violation.rule.includes('1.1.1')) {
          expect(violation.codeExample).toContain('alt=');
        }
        if (violation.rule.includes('2.1.1')) {
          expect(violation.codeExample).toContain('tabindex') || 
          expect(violation.codeExample).toContain('onkeydown');
        }
      });
    });

    test('generates framework-specific fixes', async () => {
      const violation = {
        rule: 'WCAG 1.1.1',
        severity: 'critical' as const,
        element: '#product-image',
        message: 'Image missing alt text',
        impact: 'Screen readers cannot describe image',
        legalRisk: 'high' as const,
        howToFix: 'Add descriptive alt text',
        codeExample: '<img src="product.jpg" alt="Product name" />'
      };

      if (process.env.CLAUDE_API_KEY || process.env.OPENAI_API_KEY) {
        const autoFix = await analyzer.generateAutoFix(violation, 'React');

        expect(autoFix.fixedCode).toContain('alt=');
        expect(autoFix.commitMessage).toContain('fix(a11y)');
        expect(autoFix.prDescription).toContain('accessibility');
        expect(autoFix.testCases.length).toBeGreaterThan(0);
        expect(autoFix.rollbackInstructions).toBeDefined();
      }
    });
  });

  test.describe('Real-world Scenarios', () => {
    test('scans e-commerce checkout flow', async () => {
      const checkoutPage = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <title>Checkout - Example Store</title>
          <style>
            .error { color: #ff0000; font-size: 12px; }
            .required::after { content: '*'; color: red; }
          </style>
        </head>
        <body>
          <h1>Checkout</h1>
          <form>
            <h2>Billing Information</h2>
            
            <div>
              <label class="required">Email</label>
              <input type="email" required>
              <div class="error">Please enter a valid email</div>
            </div>
            
            <div>
              <span class="required">Credit Card</span>
              <input type="text" placeholder="1234 5678 9012 3456">
            </div>
            
            <button type="submit" style="background: #28a745; border: none; padding: 12px 24px;">
              Complete Purchase
            </button>
          </form>
        </body>
        </html>
      `;

      const result = await scanner.scanWebsite({
        url: 'data:text/html;charset=utf-8,' + encodeURIComponent(checkoutPage),
        depth: 'exhaustive',
        wcagLevel: 'AA'
      });

      // Should detect form labeling issues
      const formViolations = result.violations.filter(v => 
        v.rule.includes('3.3.2') || v.rule.includes('1.3.1')
      );
      expect(formViolations.length).toBeGreaterThan(0);

      // Calculate lawsuit risk for e-commerce
      const riskAssessment = await analyzer.generateLawsuitRiskAssessment(
        result.violations,
        {
          industry: 'E-commerce',
          estimatedRevenue: '$50M+',
          userBase: '1M+ users'
        }
      );

      // E-commerce sites with form issues should have high risk
      expect(riskAssessment.lawsuitProbability).toBeGreaterThan(50);
      expect(riskAssessment.recommendedActions.immediate.length).toBeGreaterThan(0);
    });

    test('handles dynamic content and SPAs', async () => {
      const spaPage = `
        <!DOCTYPE html>
        <html lang="en">
        <head><title>SPA Test</title></head>
        <body>
          <div id="app">Loading...</div>
          <script>
            setTimeout(() => {
              document.getElementById('app').innerHTML = \`
                <nav>
                  <ul>
                    <li><a href="#home">Home</a></li>
                    <li><a href="#about">About</a></li>
                    <li><a href="#contact">Contact</a></li>
                  </ul>
                </nav>
                <main>
                  <h1>Welcome</h1>
                  <img src="hero.jpg" />
                  <button onclick="loadMore()">Load More</button>
                </main>
              \`;
            }, 1000);
          </script>
        </body>
        </html>
      `;

      const result = await scanner.scanWebsite({
        url: 'data:text/html;charset=utf-8,' + encodeURIComponent(spaPage),
        depth: 'interactive',
        wcagLevel: 'AA'
      });

      // Should wait for dynamic content and detect violations
      expect(result.elements.length).toBeGreaterThan(5);
      
      const violations = result.violations.filter(v => 
        v.element.includes('img') || v.element.includes('button')
      );
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  test.describe('Performance and Scalability', () => {
    test('completes scan within reasonable time', async () => {
      const complexPage = `
        <!DOCTYPE html>
        <html lang="en">
        <head><title>Complex Page</title></head>
        <body>
          ${Array.from({ length: 100 }, (_, i) => `
            <div>
              <h3>Section ${i + 1}</h3>
              <img src="image${i}.jpg">
              <p>Content for section ${i + 1}</p>
              <button onclick="action${i}()">Action ${i + 1}</button>
            </div>
          `).join('')}
        </body>
        </html>
      `;

      const startTime = Date.now();
      
      const result = await scanner.scanWebsite({
        url: 'data:text/html;charset=utf-8,' + encodeURIComponent(complexPage),
        depth: 'surface',
        wcagLevel: 'AA'
      });

      const duration = Date.now() - startTime;
      
      // Should complete within 30 seconds for surface scan
      expect(duration).toBeLessThan(30000);
      expect(result.elements.length).toBeGreaterThan(300); // 100 sections × 3+ elements each
      expect(result.violations.length).toBeGreaterThan(100); // Should find missing alt text
    });

    test('handles scan failures gracefully', async () => {
      // Test with invalid URL
      await expect(async () => {
        await scanner.scanWebsite({
          url: 'https://this-domain-definitely-does-not-exist-12345.com',
          depth: 'surface',
          wcagLevel: 'AA'
        });
      }).rejects.toThrow();

      // Test with malformed HTML
      const malformedPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Malformed</title>
        <body>
          <div><img src="test.jpg"<button>Broken HTML
        </html>
      `;

      const result = await scanner.scanWebsite({
        url: 'data:text/html;charset=utf-8,' + encodeURIComponent(malformedPage),
        depth: 'surface',
        wcagLevel: 'AA'
      });

      // Should still extract some elements despite malformed HTML
      expect(result.elements.length).toBeGreaterThan(0);
    });
  });
});