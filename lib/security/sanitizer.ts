/**
 * HTML Sanitization utility for report generation
 * 
 * Prevents XSS attacks in PDF and VPAT reports
 */

export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    // Basic HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    // Remove potential protocol handlers
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, '') // Remove event handlers like onclick=
    // Remove script tags if any somehow got through
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*>/gi, '')
    .replace(/<link\b[^<]*>/gi, '')
    .replace(/<meta\b[^<]*>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
}

export function sanitizeHTML(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  return html
    // Convert dangerous characters
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    // Remove javascript and other protocols
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/about:/gi, '')
    // Remove all event handlers
    .replace(/\bon\w+\s*=\s*[^>\s]+/gi, '')
    // Remove dangerous tags completely
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe[^>]*>/gi, '')
    .replace(/<object[^>]*>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/<applet[^>]*>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<form[^>]*>/gi, '')
    .replace(/<input[^>]*>/gi, '')
    .replace(/<button[^>]*>/gi, '')
    .replace(/<textarea[^>]*>/gi, '')
    .replace(/<select[^>]*>/gi, '');
}

export function sanitizeCode(code: string): string {
  if (!code || typeof code !== 'string') {
    return '';
  }
  
  // For code snippets, we want to preserve structure but escape HTML
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeURL(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }
  
  // Only allow http/https URLs, strip everything else
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return '';
  } catch {
    return '';
  }
}

export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'untitled';
  }
  
  return filename
    // Remove dangerous characters
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    // Replace multiple dashes with single
    .replace(/-+/g, '-')
    // Remove leading/trailing dashes
    .replace(/^-+|-+$/g, '')
    // Limit length
    .substring(0, 100)
    || 'untitled';
}

/**
 * Comprehensive sanitization for user-generated content in reports
 */
export function sanitizeReportContent(content: string): string {
  return sanitizeHTML(content);
}

/**
 * Test XSS payloads to verify sanitization effectiveness
 */
export const XSS_TEST_PAYLOADS = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert(1)>',
  'javascript:alert(1)',
  '<svg onload=alert(1)>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '"><script>alert(1)</script>',
  "';alert(1);//",
  '<style>@import"javascript:alert(1)"</style>',
  '<link rel=stylesheet href="javascript:alert(1)">',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  '<object data="javascript:alert(1)">',
  '<embed src="javascript:alert(1)">',
  '<form action="javascript:alert(1)">',
  '<input onfocus=alert(1) autofocus>',
  '<select onfocus=alert(1) autofocus>',
  '<textarea onfocus=alert(1) autofocus>',
  '<button onclick=alert(1)>',
  '<body onload=alert(1)>',
  '<div style="background:url(javascript:alert(1))">',
  'data:text/html,<script>alert(1)</script>'
];

/**
 * Test function to validate sanitization
 */
export function testSanitization(): { passed: number; total: number; details: string[] } {
  const results: string[] = [];
  let passed = 0;
  
  for (const payload of XSS_TEST_PAYLOADS) {
    const sanitized = sanitizeHTML(payload);
    
    const isSafe = !sanitized.includes('<script') && 
                   !sanitized.includes('javascript:') && 
                   !sanitized.includes('onerror=') &&
                   !sanitized.includes('onload=') &&
                   !sanitized.includes('onclick=') &&
                   !sanitized.includes('onfocus=') &&
                   !sanitized.includes('<iframe') &&
                   !sanitized.includes('<object') &&
                   !sanitized.includes('<embed') &&
                   !sanitized.includes('data:text/html');
    
    if (isSafe) {
      passed++;
      results.push(`✅ ${payload} -> ${sanitized}`);
    } else {
      results.push(`❌ ${payload} -> ${sanitized}`);
    }
  }
  
  return {
    passed,
    total: XSS_TEST_PAYLOADS.length,
    details: results
  };
}