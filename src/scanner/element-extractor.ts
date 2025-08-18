import { Page } from 'playwright';
import { PageElement } from './types';

export async function extractPageElements(page: Page): Promise<PageElement[]> {
  return await page.evaluate(() => {
    const elements: PageElement[] = [];
    
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
        opacity: styles.opacity,
        position: styles.position,
        zIndex: styles.zIndex,
        textDecoration: styles.textDecoration,
        fontFamily: styles.fontFamily,
        lineHeight: styles.lineHeight,
        letterSpacing: styles.letterSpacing
      };
    };

    const generateSelector = (el: Element): string => {
      // Generate a unique CSS selector for the element
      if (el.id) return `#${el.id}`;
      
      let selector = el.tagName.toLowerCase();
      if (el.className) {
        const classes = el.className.split(' ').filter(c => c).join('.');
        if (classes) selector += `.${classes}`;
      }
      
      // Add nth-child if needed for uniqueness
      const parent = el.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(el);
        if (siblings.filter(s => s.tagName === el.tagName).length > 1) {
          selector += `:nth-child(${index + 1})`;
        }
      }
      
      return selector;
    };

    const isElementVisible = (el: Element): boolean => {
      const styles = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      
      return styles.display !== 'none' &&
             styles.visibility !== 'hidden' &&
             styles.opacity !== '0' &&
             rect.width > 0 &&
             rect.height > 0;
    };

    const extractElement = (el: Element, type: PageElement['type']): PageElement => {
      const htmlEl = el as HTMLElement;
      return {
        type,
        html: el.outerHTML.substring(0, 1000), // Limit HTML length
        selector: generateSelector(el),
        attributes: getAttributes(el),
        computedStyles: getComputedStyles(el),
        text: htmlEl.textContent?.trim() || '',
        ariaAttributes: getAriaAttributes(el),
        parentContext: el.parentElement?.outerHTML.substring(0, 500) || '',
        isInteractive: false,
        keyboardAccessible: el.getAttribute('tabindex') !== '-1',
        tabIndex: parseInt(el.getAttribute('tabindex') || '0')
      };
    };

    // Extract all relevant elements for comprehensive scanning
    const selectors = {
      images: 'img, [role="img"], svg, canvas, picture',
      buttons: 'button, [role="button"], input[type="submit"], input[type="button"], input[type="reset"]',
      links: 'a[href]',
      forms: 'form',
      inputs: 'input:not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select',
      labels: 'label',
      headings: 'h1, h2, h3, h4, h5, h6, [role="heading"]',
      lists: 'ul, ol, dl, [role="list"]',
      tables: 'table',
      media: 'video, audio, embed, object',
      iframes: 'iframe',
      landmarks: '[role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"], nav, main, aside, header, footer'
    };

    // Images
    document.querySelectorAll(selectors.images).forEach(el => {
      if (isElementVisible(el)) {
        const element = extractElement(el, 'image');
        element.isInteractive = false;
        elements.push(element);
      }
    });

    // Buttons
    document.querySelectorAll(selectors.buttons).forEach(el => {
      if (isElementVisible(el)) {
        const element = extractElement(el, 'button');
        element.isInteractive = true;
        elements.push(element);
      }
    });

    // Links
    document.querySelectorAll(selectors.links).forEach(el => {
      if (isElementVisible(el)) {
        const element = extractElement(el, 'link');
        element.isInteractive = true;
        elements.push(element);
      }
    });

    // Forms and inputs
    document.querySelectorAll(selectors.forms).forEach(form => {
      if (isElementVisible(form)) {
        const formElement = extractElement(form, 'form');
        elements.push(formElement);
      }
    });

    document.querySelectorAll(selectors.inputs).forEach(el => {
      if (isElementVisible(el)) {
        const element = extractElement(el, 'form');
        element.isInteractive = true;
        elements.push(element);
      }
    });

    // Labels (important for form accessibility)
    document.querySelectorAll(selectors.labels).forEach(el => {
      if (isElementVisible(el)) {
        const element = extractElement(el, 'form');
        elements.push(element);
      }
    });

    // Headings
    document.querySelectorAll(selectors.headings).forEach(el => {
      if (isElementVisible(el)) {
        const element = extractElement(el, 'heading');
        elements.push(element);
      }
    });

    // Lists
    document.querySelectorAll(selectors.lists).forEach(el => {
      if (isElementVisible(el)) {
        const element = extractElement(el, 'list');
        elements.push(element);
      }
    });

    // Tables
    document.querySelectorAll(selectors.tables).forEach(el => {
      if (isElementVisible(el)) {
        const element = extractElement(el, 'table');
        elements.push(element);
      }
    });

    // Media elements
    document.querySelectorAll(selectors.media).forEach(el => {
      if (isElementVisible(el)) {
        const type = el.tagName.toLowerCase() as 'video' | 'audio';
        const element = extractElement(el, type);
        element.isInteractive = true;
        elements.push(element);
      }
    });

    // Text elements for contrast checking
    const textSelectors = 'p, span, div, li, td, th, dt, dd, blockquote, article, section';
    document.querySelectorAll(textSelectors).forEach(el => {
      const htmlEl = el as HTMLElement;
      if (isElementVisible(el) && htmlEl.textContent && htmlEl.textContent.trim().length > 0) {
        // Only include if it has direct text content (not just from children)
        const hasDirectText = Array.from(el.childNodes).some(
          node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
        );
        
        if (hasDirectText) {
          const element = extractElement(el, 'text');
          elements.push(element);
        }
      }
    });

    return elements;
  });
}