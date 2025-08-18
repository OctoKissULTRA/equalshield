import { Browser, Page, chromium } from 'playwright';
import { extractPageElements } from './element-extractor';
import { WCAGRules } from './wcag-rules';
import { PageElement, ScanConfig, PageScanResult, ComplianceSummary, Violation } from './types';

export class ComplianceScanner {
  private browser: Browser | null = null;
  private wcagRules: WCAGRules;

  constructor() {
    this.wcagRules = new WCAGRules();
  }

  async scanWebsite(config: ScanConfig) {
    const scanResult = {
      url: config.url,
      timestamp: new Date().toISOString(),
      pages: [] as PageScanResult[],
      summary: {} as ComplianceSummary,
      violations: [] as Violation[],
      riskScore: 0,
      elements: [] as PageElement[]
    };

    try {
      // Initialize Playwright with specific accessibility testing config
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--force-prefers-reduced-motion',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      });

      const page = await this.browser.newPage();
      
      // Enable accessibility tree
      await page.addInitScript(() => {
        // Inject axe-core for additional validation
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js';
        document.head.appendChild(script);
      });

      // Main scanning logic
      const elements = await this.extractAllElements(page, config.url);
      const violations = await this.detectViolations(elements);
      const riskScore = await this.calculateRiskScore(violations);
      
      scanResult.elements = elements;
      scanResult.violations = violations;
      scanResult.riskScore = riskScore;
      
      return scanResult;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
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

  private async detectViolations(elements: PageElement[]): Promise<Violation[]> {
    const violations: Violation[] = [];

    // Apply all WCAG rules
    for (const element of elements) {
      const ruleViolations = this.wcagRules.checkElement(element);
      violations.push(...ruleViolations);
    }

    return violations;
  }

  private async calculateRiskScore(violations: Violation[]): Promise<number> {
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