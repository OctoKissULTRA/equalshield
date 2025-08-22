import dns from 'node:dns/promises';
import { AddressInfo } from 'net';

// IP address validation using built-in Node.js net module
function isPrivateIP(address: string): boolean {
  // Check for common private/local ranges
  const privateRanges = [
    /^127\./,                   // Loopback
    /^10\./,                    // Private Class A
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private Class B
    /^192\.168\./,              // Private Class C
    /^169\.254\./,              // Link-local
    /^::1$/,                    // IPv6 loopback
    /^fe80:/i,                  // IPv6 link-local
    /^fc00:/i,                  // IPv6 unique local
    /^fd00:/i,                  // IPv6 unique local
  ];
  
  return privateRanges.some(range => range.test(address));
}

export async function isPublicHttpUrl(urlStr: string): Promise<boolean> {
  try {
    const u = new URL(urlStr);
    
    // Only allow HTTP(S) protocols
    if (!['http:', 'https:'].includes(u.protocol)) {
      return false;
    }
    
    const host = u.hostname.toLowerCase();
    
    // Block common local/private hostnames
    const bannedHosts = new Set([
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      'host.docker.internal',
      'kubernetes.docker.internal'
    ]);
    
    if (bannedHosts.has(host)) {
      return false;
    }
    
    // Block internal domains
    if (host.endsWith('.internal') || 
        host.endsWith('.local') || 
        host.endsWith('.localhost')) {
      return false;
    }
    
    // Block AWS metadata endpoint
    if (host === '169.254.169.254' || host === 'metadata.google.internal') {
      return false;
    }
    
    // Resolve DNS and check all addresses
    try {
      const addresses = await dns.lookup(host, { all: true, verbatim: true });
      
      // Check if any resolved address is private
      for (const addr of addresses) {
        if (isPrivateIP(addr.address)) {
          return false;
        }
      }
      
      return true;
    } catch (dnsError) {
      // DNS resolution failed - block by default
      console.error(`DNS resolution failed for ${host}:`, dnsError);
      return false;
    }
  } catch (error) {
    // Invalid URL or other error
    console.error('URL validation error:', error);
    return false;
  }
}

// Validate URL for scanning with additional business rules
export async function validateScanUrl(url: string): Promise<{ valid: boolean; error?: string }> {
  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
  
  // Check for public HTTP(S) URL
  const isPublic = await isPublicHttpUrl(url);
  if (!isPublic) {
    return { 
      valid: false, 
      error: 'URL must be publicly accessible. Private networks and local addresses are not allowed.' 
    };
  }
  
  // Additional business rules
  const u = new URL(url);
  
  // Block URLs with authentication in them
  if (u.username || u.password) {
    return { valid: false, error: 'URLs with embedded credentials are not allowed' };
  }
  
  // Block data: and javascript: pseudo-protocols (shouldn't get here but extra safety)
  if (u.protocol === 'data:' || u.protocol === 'javascript:') {
    return { valid: false, error: 'Invalid protocol' };
  }
  
  return { valid: true };
}

// Crawl budget configuration per tier
export const CRAWL_LIMITS = {
  free: {
    maxPages: 5,
    maxDepth: 1,
    maxTimeMs: 120000, // 2 minutes
  },
  starter: {
    maxPages: 15,
    maxDepth: 2,
    maxTimeMs: 180000, // 3 minutes
  },
  pro: {
    maxPages: 50,
    maxDepth: 3,
    maxTimeMs: 300000, // 5 minutes
  },
  enterprise: {
    maxPages: 500,
    maxDepth: 5,
    maxTimeMs: 600000, // 10 minutes
  },
} as const;

export type Tier = keyof typeof CRAWL_LIMITS;