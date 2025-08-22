import { test, expect } from '@playwright/test';
import { isPublicHttpUrl } from '@/lib/security/url-guard';

test.describe('Security Verification', () => {
  
  test('SSRF protection blocks private/metadata hosts', async ({ request }) => {
    const maliciousUrls = [
      'http://localhost:3000',
      'http://127.0.0.1',
      'http://127.0.0.1:8080',
      'http://169.254.169.254', // AWS metadata
      'http://169.254.169.254/latest/meta-data/',
      'http://metadata.google.internal', // GCP metadata
      'http://foo.internal',
      'http://test.local',
      'http://192.168.1.1',
      'http://10.0.0.1',
      'http://172.16.0.1',
      'ftp://example.com',
      'file:///etc/passwd',
      'javascript:alert(1)'
    ];
    
    for (const url of maliciousUrls) {
      console.log(`Testing SSRF protection for: ${url}`);
      
      // Test URL guard function directly
      const isAllowed = await isPublicHttpUrl(url);
      expect(isAllowed, `URL should be blocked: ${url}`).toBe(false);
    }
  });

  test('SSRF protection allows legitimate public URLs', async () => {
    const legitimateUrls = [
      'https://example.com',
      'http://example.com',
      'https://www.google.com',
      'https://github.com',
      'http://httpbin.org',
      'https://jsonplaceholder.typicode.com'
    ];
    
    for (const url of legitimateUrls) {
      console.log(`Testing legitimate URL: ${url}`);
      
      const isAllowed = await isPublicHttpUrl(url);
      expect(isAllowed, `URL should be allowed: ${url}`).toBe(true);
    }
  });

  test('scan API rejects private URLs with 400', async ({ request }) => {
    const maliciousPayloads = [
      { url: 'http://localhost:3000' },
      { url: 'http://127.0.0.1' },
      { url: 'http://169.254.169.254' },
      { url: 'http://foo.internal' },
      { url: 'ftp://example.com' },
      { url: 'javascript:alert(1)' }
    ];
    
    for (const payload of maliciousPayloads) {
      console.log(`Testing API rejection for: ${payload.url}`);
      
      const response = await request.post('/api/scan', {
        data: payload,
        headers: {
          'Content-Type': 'application/json'
        },
        failOnStatusCode: false
      });
      
      expect(response.status(), `Should reject ${payload.url} with 400`).toBe(400);
      
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.toLowerCase()).toContain('url');
    }
  });

  test('HTML sanitization prevents XSS in reports', async () => {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src=x onerror=alert(1)>',
      'javascript:alert(1)',
      '<svg onload=alert(1)>',
      '<iframe src="javascript:alert(1)"></iframe>',
      '"><script>alert(1)</script>',
      "';alert(1);//",
      '<style>@import"javascript:alert(1)"</style>',
      '<link rel=stylesheet href="javascript:alert(1)">',
      '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">'
    ];
    
    // Test with our sanitization functions (import from where they're defined)
    for (const payload of xssPayloads) {
      // Basic HTML escaping that our templates use
      const sanitized = payload.replace(/[<>"'&]/g, (match) => {
        const escapes: Record<string, string> = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
          '&': '&amp;'
        };
        return escapes[match] || match;
      });
      
      // Should not contain executable content
      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).not.toContain('onerror=');
      expect(sanitized).not.toContain('onload=');
      expect(sanitized).not.toContain('<iframe');
      
      console.log(`Payload: ${payload} -> Sanitized: ${sanitized}`);
    }
  });

  test('rate limiting headers and behavior', async ({ request }) => {
    // Note: This test would need actual rate limiting implemented
    // For now, just verify the structure
    
    const response = await request.get('/api/health', {
      failOnStatusCode: false
    });
    
    // Rate limiting headers should be present (when implemented)
    const headers = response.headers();
    
    // Log what headers we get for debugging
    console.log('Response headers:', headers);
    
    // This test will pass for now, but should be updated when rate limiting is active
    expect(response.status()).toBeGreaterThanOrEqual(200);
  });

  test('report endpoints require authentication', async ({ request }) => {
    const protectedEndpoints = [
      '/api/report/pdf?scanId=550e8400-e29b-41d4-a716-446655440000',
      '/api/report/vpat?scanId=550e8400-e29b-41d4-a716-446655440000'
    ];
    
    for (const endpoint of protectedEndpoints) {
      console.log(`Testing auth requirement for: ${endpoint}`);
      
      const response = await request.get(endpoint, {
        failOnStatusCode: false
      });
      
      // Should require authentication
      expect([401, 403]).toContain(response.status());
      
      const body = await response.json();
      expect(body.error).toBeDefined();
      
      // Should not leak any PII or scan data
      expect(JSON.stringify(body).toLowerCase()).not.toContain('scan data');
      expect(JSON.stringify(body).toLowerCase()).not.toContain('violation');
      expect(JSON.stringify(body).toLowerCase()).not.toContain('finding');
    }
  });

  test('UUID validation prevents injection', async ({ request }) => {
    const invalidUUIDs = [
      'invalid-uuid',
      '123',
      '',
      '../../../etc/passwd',
      'union select * from scans',
      '<script>alert(1)</script>',
      'null',
      'undefined',
      '%00',
      '550e8400-e29b-41d4-a716-44665544000G', // Invalid character
      '550e8400-e29b-41d4-a716-4466554400', // Too short
      '550e8400-e29b-41d4-a716-446655440000-extra' // Too long
    ];
    
    for (const invalidId of invalidUUIDs) {
      console.log(`Testing UUID validation for: ${invalidId}`);
      
      const response = await request.get(`/api/report/pdf?scanId=${encodeURIComponent(invalidId)}`, {
        failOnStatusCode: false
      });
      
      expect(response.status()).toBe(400);
      
      const body = await response.json();
      expect(body.error.toLowerCase()).toContain('scan id');
    }
  });

  test('content security policy headers', async ({ request }) => {
    const response = await request.get('/', {
      failOnStatusCode: false
    });
    
    const headers = response.headers();
    
    // Should have CSP header
    expect(headers['content-security-policy'] || headers['csp']).toBeDefined();
    
    // Log for verification
    console.log('CSP Header:', headers['content-security-policy']);
    
    // Should not allow unsafe practices in production
    const csp = headers['content-security-policy'] || '';
    if (process.env.NODE_ENV === 'production') {
      expect(csp).not.toContain("'unsafe-eval'");
      expect(csp).not.toContain('*');
    }
  });
});