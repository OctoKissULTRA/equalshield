import { Browser, Page, chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { extractPageElements } from './element-extractor';
import { PageElement, ScanConfig, PageScanResult, ComplianceSummary, Violation } from './types';
import { CRAWL_LIMITS, Tier } from '@/lib/security/url-guard';
import { 
  initializeScan, 
  updateScanProgress, 
  onPageCrawled, 
  completeScan, 
  failScan 
} from '@/lib/realtime/progress';

export class ComplianceScanner {
  private browser: Browser | null = null;
  private tier: Tier;
  private startTime: number = 0;
  private scanId?: string;

  constructor(tier: Tier = 'free', scanId?: string) {
    this.tier = tier;
    this.scanId = scanId;
  }

  async scanWebsite(config: ScanConfig) {
    this.startTime = Date.now();
    const limits = CRAWL_LIMITS[this.tier];
    
    // Initialize progress tracking
    if (this.scanId) {
      initializeScan(this.scanId, config.url, limits.maxPages);
      updateScanProgress(this.scanId, {
        status: 'starting',
        currentStep: 'Initializing browser and security checks'
      });
    }
    
    const scanResult = {
      url: config.url,
      timestamp: new Date().toISOString(),
      pages: [] as PageScanResult[],
      summary: {} as ComplianceSummary,
      violations: [] as Violation[],
      riskScore: 0,
      tier: this.tier,
      crawlLimits: limits
    };

    try {
      // Initialize Playwright with security and accessibility config
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--force-prefers-reduced-motion',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding'
        ]
      });

      const page = await this.browser.newPage();
      
      // Set timeouts based on tier
      page.setDefaultNavigationTimeout(25000);
      page.setDefaultTimeout(15000);
      
      // SSRF protection - block internal requests
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (!['http:', 'https:'].includes(url.protocol)) {
          return route.abort();
        }
        return route.continue();
      });

      // Scan pages based on tier limits
      if (this.scanId) {
        updateScanProgress(this.scanId, {
          status: 'crawling',
          currentStep: 'Discovering pages to scan'
        });
      }
      
      const urlsToScan = await this.discoverUrls(page, config.url, limits);
      
      if (this.scanId) {
        updateScanProgress(this.scanId, {
          pagesDiscovered: urlsToScan.length,
          currentStep: `Found ${urlsToScan.length} pages to scan`
        });
      }
      
      for (let i = 0; i < urlsToScan.length; i++) {
        const url = urlsToScan[i];
        if (this.isTimeBudgetExceeded(limits)) break;
        
        if (this.scanId) {
          updateScanProgress(this.scanId, {
            currentStep: `Scanning page ${i + 1} of ${urlsToScan.length}`,
            currentPage: url
          });
        }
        
        try {
          const pageResult = await this.scanSinglePage(page, url);
          scanResult.pages.push(pageResult);
          scanResult.violations.push(...pageResult.violations);
          
          // Update progress after each page
          if (this.scanId) {
            onPageCrawled(this.scanId, url, 0, pageResult.violations.length);
          }
        } catch (error) {
          console.error(`Failed to scan page ${url}:`, error);
          
          if (this.scanId) {
            onPageCrawled(this.scanId, url, 0, 0, (error as Error).message);
          }
        }
      }

      // Calculate overall metrics
      if (this.scanId) {
        updateScanProgress(this.scanId, {
          status: 'analyzing',
          currentStep: 'Calculating compliance metrics and generating report'
        });
      }
      
      scanResult.summary = this.calculateSummary(scanResult.violations);
      scanResult.riskScore = this.calculateRiskScore(scanResult.violations);
      
      // Complete the scan with final results
      if (this.scanId) {
        const criticalViolations = scanResult.violations.filter(v => v.impact === 'critical').length;
        const quickWins = scanResult.violations.filter(v => v.tags?.includes('easy')).length;
        
        completeScan(this.scanId, {
          overallScore: Math.max(0, 100 - scanResult.riskScore),
          totalViolations: scanResult.violations.length,
          criticalIssues: criticalViolations,
          quickWins
        });
      }
      
      return scanResult;
    } catch (error) {
      // Handle scan failure
      if (this.scanId) {
        failScan(this.scanId, (error as Error).message);
      }
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  private async discoverUrls(page: Page, startUrl: string, limits: typeof CRAWL_LIMITS[Tier]): Promise<string[]> {
    const urls = new Set([startUrl]);
    const visited = new Set<string>();
    const toVisit = [startUrl];
    let depth = 0;

    try {
      // Check for robots.txt and sitemap
      const robotsUrls = await this.checkRobotsTxt(page, startUrl);
      robotsUrls.forEach(url => urls.add(url));
      
      // Discover internal links up to depth limit
      while (toVisit.length > 0 && depth < limits.maxDepth && urls.size < limits.maxPages) {
        const currentUrl = toVisit.shift()!;
        if (visited.has(currentUrl)) continue;
        
        visited.add(currentUrl);
        
        try {
          await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          
          const links = await page.evaluate((baseUrl) => {
            const baseHost = new URL(baseUrl).hostname;
            const linkElements = Array.from(document.querySelectorAll('a[href]'));
            
            return linkElements
              .map(a => a.getAttribute('href'))
              .filter(href => href && !href.startsWith('#') && !href.startsWith('mailto:'))
              .map(href => {
                try {
                  const url = new URL(href, baseUrl);
                  return url.hostname === baseHost ? url.href : null;
                } catch {
                  return null;
                }
              })
              .filter(Boolean) as string[];
          }, startUrl);
          
          links.forEach(link => {
            if (urls.size < limits.maxPages) {
              urls.add(link);
              toVisit.push(link);
            }
          });
          
        } catch (error) {
          console.warn(`Failed to discover links from ${currentUrl}:`, error);
        }
        
        depth++;
      }
    } catch (error) {
      console.warn('URL discovery failed:', error);
    }

    return Array.from(urls).slice(0, limits.maxPages);
  }

  private async checkRobotsTxt(page: Page, startUrl: string): Promise<string[]> {
    const urls: string[] = [];
    const baseUrl = new URL(startUrl);
    
    try {
      const robotsUrl = `${baseUrl.protocol}//${baseUrl.host}/robots.txt`;
      const response = await page.goto(robotsUrl, { timeout: 10000 });
      
      if (response?.ok()) {
        const robotsText = await response.text();
        const sitemapMatch = robotsText.match(/Sitemap:\s*(.+)/i);
        
        if (sitemapMatch) {
          const sitemapUrls = await this.parseSitemap(page, sitemapMatch[1].trim());
          urls.push(...sitemapUrls);
        }
      }
    } catch (error) {
      // Robots.txt not found or not accessible - that's fine
    }
    
    return urls;
  }

  private async parseSitemap(page: Page, sitemapUrl: string): Promise<string[]> {
    try {
      const response = await page.goto(sitemapUrl, { timeout: 10000 });
      if (!response?.ok()) return [];
      
      const sitemapXml = await response.text();
      const urlMatches = sitemapXml.match(/<loc>([^<]+)<\/loc>/g) || [];
      
      return urlMatches
        .map(match => match.replace(/<\/?loc>/g, ''))
        .slice(0, 20); // Limit sitemap URLs
        
    } catch (error) {
      return [];
    }
  }

  private async scanSinglePage(page: Page, url: string): Promise<PageScanResult> {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
      
      // Run Axe accessibility analysis
      const builder = new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .disableRules(['color-contrast-enhanced']); // Optional - AA vs AAA
      
      const axeResults = await builder.analyze();
      
      // Convert Axe violations to our format
      const violations = this.normalizeAxeViolations(axeResults.violations, url);
      
      // Take screenshot for evidence
      const screenshot = await page.screenshot({ 
        fullPage: false, 
        type: 'png',
        clip: { x: 0, y: 0, width: 1200, height: 800 }
      });
      
      return {
        url,
        timestamp: new Date().toISOString(),
        violations,
        axeResults,
        screenshot: screenshot.toString('base64'),
        pageTitle: await page.title(),
        totalElements: axeResults.violations.reduce((sum, v) => sum + v.nodes.length, 0)
      };
      
    } catch (error) {
      console.error(`Failed to scan page ${url}:`, error);
      return {
        url,
        timestamp: new Date().toISOString(),
        violations: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        pageTitle: '',
        totalElements: 0
      };
    }
  }

  private normalizeAxeViolations(axeViolations: any[], pageUrl: string): Violation[] {
    const violations: Violation[] = [];
    
    for (const violation of axeViolations) {
      const impact = violation.impact || 'minor';
      const severity = this.mapAxeImpactToSeverity(impact);
      
      for (const node of violation.nodes) {
        violations.push({
          id: `${violation.id}-${violations.length}`,
          ruleId: violation.id,
          wcagCriterion: this.mapAxeRuleToWCAG(violation.id),
          severity,
          impact,
          description: violation.description,
          help: violation.help,
          helpUrl: violation.helpUrl,
          selector: node.target.join(' '),
          snippet: node.html,
          message: node.failureSummary || violation.help,
          pageUrl,
          elementType: this.extractElementType(node.html),
          legalRisk: this.assessLegalRisk(violation.id, severity),
          quickWin: this.isQuickWin(violation.id),
          estimatedFixTime: this.estimateFixTime(violation.id),
          wcagLevel: this.getWcagLevel(violation.tags)
        });
      }
    }
    
    return violations;
  }

  private mapAxeImpactToSeverity(impact: string): 'critical' | 'serious' | 'moderate' | 'minor' {
    switch (impact) {
      case 'critical': return 'critical';
      case 'serious': return 'serious';
      case 'moderate': return 'moderate';
      default: return 'minor';
    }
  }

  private mapAxeRuleToWCAG(ruleId: string): string {
    const wcagMap: Record<string, string> = {
      'alt-text': '1.1.1',
      'color-contrast': '1.4.3',
      'label': '3.3.2',
      'link-name': '2.4.4',
      'button-name': '4.1.2',
      'heading-order': '1.3.1',
      'landmark-unique': '1.3.6',
      'keyboard': '2.1.1',
      'focus-order': '2.4.3',
      'skip-link': '2.4.1'
    };
    
    return wcagMap[ruleId] || '4.1.2'; // Default to name/role/value
  }

  private extractElementType(html: string): string {
    const tagMatch = html.match(/<(\w+)/);
    return tagMatch ? tagMatch[1].toLowerCase() : 'unknown';
  }

  private assessLegalRisk(ruleId: string, severity: string): 'high' | 'medium' | 'low' {
    // High-risk rules that commonly result in lawsuits
    const highRiskRules = ['alt-text', 'color-contrast', 'label', 'keyboard', 'link-name'];
    
    if (highRiskRules.includes(ruleId) && ['critical', 'serious'].includes(severity)) {
      return 'high';
    }
    
    if (severity === 'serious') return 'medium';
    return 'low';
  }

  private isQuickWin(ruleId: string): boolean {
    // Rules that can be fixed quickly
    const quickWinRules = ['alt-text', 'label', 'link-name', 'button-name', 'heading-order'];
    return quickWinRules.includes(ruleId);
  }

  private estimateFixTime(ruleId: string): string {
    const timeMap: Record<string, string> = {
      'alt-text': '2-5 minutes',
      'label': '1-3 minutes',
      'link-name': '1-2 minutes',
      'button-name': '1-2 minutes',
      'color-contrast': '10-30 minutes',
      'keyboard': '30-60 minutes',
      'heading-order': '5-15 minutes'
    };
    
    return timeMap[ruleId] || '15-30 minutes';
  }

  private getWcagLevel(tags: string[]): 'A' | 'AA' | 'AAA' {
    if (tags.includes('wcag2aaa')) return 'AAA';
    if (tags.includes('wcag2aa')) return 'AA';
    return 'A';
  }

  private isTimeBudgetExceeded(limits: typeof CRAWL_LIMITS[Tier]): boolean {
    return (Date.now() - this.startTime) > limits.maxTimeMs;
  }

  private calculateSummary(violations: Violation[]): ComplianceSummary {
    const summary = {
      totalViolations: violations.length,
      critical: violations.filter(v => v.severity === 'critical').length,
      serious: violations.filter(v => v.severity === 'serious').length,
      moderate: violations.filter(v => v.severity === 'moderate').length,
      minor: violations.filter(v => v.severity === 'minor').length,
      wcagAACompliant: violations.filter(v => ['critical', 'serious'].includes(v.severity)).length === 0,
      quickWins: violations.filter(v => v.quickWin).length,
      estimatedFixTime: this.calculateTotalFixTime(violations),
      topIssues: this.getTopIssues(violations),
      complianceScore: this.calculateComplianceScore(violations)
    };
    
    return summary;
  }

  private calculateTotalFixTime(violations: Violation[]): string {
    const totalMinutes = violations.reduce((sum, v) => {
      const timeStr = v.estimatedFixTime || '15-30 minutes';
      const minutes = parseInt(timeStr.split('-')[0]) || 15;
      return sum + minutes;
    }, 0);
    
    if (totalMinutes < 60) return `${totalMinutes} minutes`;
    const hours = Math.round(totalMinutes / 60 * 10) / 10;
    return `${hours} hours`;
  }

  private getTopIssues(violations: Violation[]): Array<{ rule: string; count: number; wcag: string }> {
    const ruleGroups = violations.reduce((groups, v) => {
      const key = v.ruleId;
      if (!groups[key]) {
        groups[key] = { rule: key, count: 0, wcag: v.wcagCriterion };
      }
      groups[key].count++;
      return groups;
    }, {} as Record<string, { rule: string; count: number; wcag: string }>);
    
    return Object.values(ruleGroups)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private calculateComplianceScore(violations: Violation[]): number {
    if (violations.length === 0) return 100;
    
    let penalty = 0;
    violations.forEach(v => {
      switch (v.severity) {
        case 'critical': penalty += 10; break;
        case 'serious': penalty += 5; break;
        case 'moderate': penalty += 2; break;
        case 'minor': penalty += 1; break;
      }
    });
    
    return Math.max(0, Math.min(100, 100 - penalty));
  }

  private async extractAllElements(page: Page, url: string): Promise<PageElement[]> {
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // Wait for axe-core to load
    await page.waitForTimeout(2000);
    
    // Extract ALL relevant elements for WCAG compliance
    const elements = await page.evaluate(() => {
      const getAttributes = (el: Element): Record<string, string> => {
        const attrs: Record<string, string> = {};
        for (const attr of Array.from(el.attributes)) {
          attrs[attr.name] = attr.value;
        }
        return attrs;
      };

      const getAriaAttributes = (el: Element): Record<string, string> => {
        const aria: Record<string, string> = {};
        for (const attr of Array.from(el.attributes)) {
          if (attr.name.startsWith('aria-')) {
            aria[attr.name] = attr.value;
          }
        }
        return aria;
      };

      const getComputedStyles = (el: Element): Partial<CSSStyleDeclaration> => {
        const styles = window.getComputedStyle(el);
        return {
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          fontSize: styles.fontSize,
          fontWeight: styles.fontWeight,
          display: styles.display,
          visibility: styles.visibility,
          opacity: styles.opacity
        };
      };

      const generateSelector = (el: Element): string => {
        if (el.id) return `#${el.id}`;
        if (el.className) return `.${el.className.split(' ')[0]}`;
        return el.tagName.toLowerCase();
      };

      const elements: PageElement[] = [];
      
      // Images - WCAG 1.1.1
      document.querySelectorAll('img, [role="img"], svg, canvas').forEach(el => {
        elements.push({
          type: 'image',
          html: el.outerHTML.substring(0, 500),
          selector: generateSelector(el),
          attributes: getAttributes(el),
          computedStyles: getComputedStyles(el),
          text: el.getAttribute('alt') || '',
          ariaAttributes: getAriaAttributes(el),
          parentContext: el.parentElement?.outerHTML.substring(0, 200) || '',
          isInteractive: false,
          keyboardAccessible: false,
          tabIndex: parseInt(el.getAttribute('tabindex') || '0')
        });
      });

      // Buttons and interactive elements - WCAG 2.1.1, 4.1.2
      document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"], a[href]').forEach(el => {
        const htmlEl = el as HTMLElement;
        elements.push({
          type: 'button',
          html: el.outerHTML.substring(0, 500),
          selector: generateSelector(el),
          attributes: getAttributes(el),
          computedStyles: getComputedStyles(el),
          text: htmlEl.textContent || el.getAttribute('aria-label') || '',
          ariaAttributes: getAriaAttributes(el),
          parentContext: el.parentElement?.outerHTML.substring(0, 200) || '',
          isInteractive: true,
          keyboardAccessible: el.getAttribute('tabindex') !== '-1',
          tabIndex: parseInt(el.getAttribute('tabindex') || '0')
        });
      });

      // Forms - WCAG 3.3.2, 1.3.5
      document.querySelectorAll('form, input, select, textarea, label').forEach(el => {
        const htmlEl = el as HTMLElement;
        elements.push({
          type: 'form',
          html: el.outerHTML.substring(0, 500),
          selector: generateSelector(el),
          attributes: getAttributes(el),
          computedStyles: getComputedStyles(el),
          text: htmlEl.textContent || '',
          ariaAttributes: getAriaAttributes(el),
          parentContext: el.parentElement?.outerHTML.substring(0, 200) || '',
          isInteractive: ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName),
          keyboardAccessible: el.getAttribute('tabindex') !== '-1',
          tabIndex: parseInt(el.getAttribute('tabindex') || '0')
        });
      });

      // Headings - WCAG 1.3.1
      document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
        const htmlEl = el as HTMLElement;
        elements.push({
          type: 'heading',
          html: el.outerHTML.substring(0, 500),
          selector: generateSelector(el),
          attributes: getAttributes(el),
          computedStyles: getComputedStyles(el),
          text: htmlEl.textContent || '',
          ariaAttributes: getAriaAttributes(el),
          parentContext: el.parentElement?.outerHTML.substring(0, 200) || '',
          isInteractive: false,
          keyboardAccessible: false,
          tabIndex: 0
        });
      });

      // Links - WCAG 2.4.4
      document.querySelectorAll('a[href]').forEach(el => {
        const htmlEl = el as HTMLElement;
        elements.push({
          type: 'link',
          html: el.outerHTML.substring(0, 500),
          selector: generateSelector(el),
          attributes: getAttributes(el),
          computedStyles: getComputedStyles(el),
          text: htmlEl.textContent || el.getAttribute('aria-label') || '',
          ariaAttributes: getAriaAttributes(el),
          parentContext: el.parentElement?.outerHTML.substring(0, 200) || '',
          isInteractive: true,
          keyboardAccessible: el.getAttribute('tabindex') !== '-1',
          tabIndex: parseInt(el.getAttribute('tabindex') || '0')
        });
      });

      // Check color contrast - WCAG 1.4.3
      document.querySelectorAll('p, span, div, li, td, th').forEach(el => {
        const htmlEl = el as HTMLElement;
        const styles = window.getComputedStyle(el);
        if (htmlEl.textContent && htmlEl.textContent.trim().length > 0) {
          elements.push({
            type: 'text',
            html: el.outerHTML.substring(0, 200),
            selector: generateSelector(el),
            attributes: getAttributes(el),
            computedStyles: {
              color: styles.color,
              backgroundColor: styles.backgroundColor,
              fontSize: styles.fontSize,
              fontWeight: styles.fontWeight
            },
            text: htmlEl.textContent.substring(0, 100) || '',
            ariaAttributes: getAriaAttributes(el),
            parentContext: '',
            isInteractive: false,
            keyboardAccessible: false,
            tabIndex: 0
          });
        }
      });

      // Videos and audio - WCAG 1.2.1, 1.2.2
      document.querySelectorAll('video, audio').forEach(el => {
        elements.push({
          type: el.tagName.toLowerCase() as 'video' | 'audio',
          html: el.outerHTML.substring(0, 500),
          selector: generateSelector(el),
          attributes: getAttributes(el),
          computedStyles: getComputedStyles(el),
          text: '',
          ariaAttributes: getAriaAttributes(el),
          parentContext: el.parentElement?.outerHTML.substring(0, 200) || '',
          isInteractive: true,
          keyboardAccessible: el.getAttribute('tabindex') !== '-1',
          tabIndex: parseInt(el.getAttribute('tabindex') || '0')
        });
      });

      return elements;
    });

    return elements;
  }

  private calculateRiskScore(violations: Violation[]): number {
    let score = 0;
    
    // Weight violations by severity and legal risk
    for (const violation of violations) {
      if (violation.severity === 'critical') score += 20;
      else if (violation.severity === 'serious') score += 10;
      else if (violation.severity === 'moderate') score += 5;
      else score += 2;

      if (violation.legalRisk === 'high') score += 15;
      else if (violation.legalRisk === 'medium') score += 8;
      else score += 3;
    }

    return Math.min(100, score);
  }

  private generateAltTextSuggestion(img: PageElement): string {
    // Analyze image context to suggest appropriate alt text
    const fileName = img.attributes.src?.split('/').pop()?.split('.')[0] || '';
    const ariaLabel = img.ariaAttributes['aria-label'] || '';
    const title = img.attributes.title || '';
    
    if (fileName) {
      return fileName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    return 'Descriptive text for this image';
  }

  private generateFixCode(element: PageElement, fixType: string): string {
    switch (fixType) {
      case 'alt-text':
        return `<img src="${element.attributes.src}" alt="[Describe the image content]" />`;
      case 'contrast':
        return `/* Increase contrast ratio to meet WCAG AA standards */
.element {
  color: #1a1a1a; /* Darker text */
  background-color: #ffffff; /* Light background */
}`;
      case 'keyboard':
        return `<button tabindex="0" onkeydown="if(event.key === 'Enter' || event.key === ' ') handleClick()">
  ${element.text}
</button>`;
      case 'label':
        const inputId = element.attributes.id || 'input-id';
        return `<label for="${inputId}">Label text</label>
<input id="${inputId}" type="${element.attributes.type || 'text'}" />`;
      default:
        return '// Fix implementation needed';
    }
  }

  private hasAssociatedLabel(input: PageElement, elements: PageElement[]): boolean {
    const inputId = input.attributes.id;
    if (!inputId) return false;
    
    return elements.some(el => 
      el.type === 'form' && 
      el.html.includes('<label') && 
      el.attributes.for === inputId
    );
  }

  private suggestColorFix(styles: Partial<CSSStyleDeclaration>): string {
    return `Current contrast ratio is insufficient. 
    Suggested fixes:
    1. Darken text color to #1a1a1a
    2. Lighten background to #ffffff
    3. Increase font size to 16px minimum
    4. Use font-weight: 500 or higher`;
  }
}