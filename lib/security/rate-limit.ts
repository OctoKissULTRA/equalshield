import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

// In-memory rate limiter for development
// TODO: Replace with Upstash Redis or Supabase KV for production
class InMemoryRateLimiter {
  private buckets: Map<string, { count: number; resetAt: number }> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    
    // Clean up old buckets every minute
    setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of this.buckets.entries()) {
        if (bucket.resetAt < now) {
          this.buckets.delete(key);
        }
      }
    }, 60000);
  }

  async limit(key: string): Promise<{ success: boolean; remaining: number; reset: number }> {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    
    if (!bucket || bucket.resetAt < now) {
      // New window
      const resetAt = now + this.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return { 
        success: true, 
        remaining: this.maxRequests - 1, 
        reset: Math.floor(resetAt / 1000) 
      };
    }
    
    if (bucket.count >= this.maxRequests) {
      // Rate limited
      return { 
        success: false, 
        remaining: 0, 
        reset: Math.floor(bucket.resetAt / 1000) 
      };
    }
    
    // Increment counter
    bucket.count++;
    return { 
      success: true, 
      remaining: this.maxRequests - bucket.count, 
      reset: Math.floor(bucket.resetAt / 1000) 
    };
  }
}

// Production implementation with Upstash Redis (when configured)
// import { Ratelimit } from '@upstash/ratelimit';
// import { Redis } from '@upstash/redis';

let rateLimiter: InMemoryRateLimiter | null = null;

function getRateLimiter() {
  if (!rateLimiter) {
    // Use in-memory for now, replace with Redis in production
    rateLimiter = new InMemoryRateLimiter(10, 60000); // 10 requests per minute
  }
  return rateLimiter;
}

// Rate limiters for different endpoints
export const scanLimiter = {
  free: { requests: 5, window: '1m' },
  starter: { requests: 20, window: '1m' },
  pro: { requests: 100, window: '1m' },
  enterprise: { requests: 1000, window: '1m' },
};

export async function rateLimitCheck(
  identifier: string,
  tier: keyof typeof scanLimiter = 'free'
): Promise<{ 
  success: boolean; 
  remaining: number; 
  reset: number;
  headers: Headers;
}> {
  const limiter = getRateLimiter();
  const limits = scanLimiter[tier];
  const maxRequests = limits.requests;
  
  const result = await limiter.limit(identifier);
  
  // Prepare rate limit headers
  const responseHeaders = new Headers();
  responseHeaders.set('X-RateLimit-Limit', String(maxRequests));
  responseHeaders.set('X-RateLimit-Remaining', String(result.remaining));
  responseHeaders.set('X-RateLimit-Reset', String(result.reset));
  
  if (!result.success) {
    const retryAfter = result.reset - Math.floor(Date.now() / 1000);
    responseHeaders.set('Retry-After', String(Math.max(1, retryAfter)));
  }
  
  return {
    ...result,
    headers: responseHeaders
  };
}

// Helper to get client identifier
export async function getClientIdentifier(req?: Request): Promise<string> {
  const headersList = headers();
  
  // Try to get from authenticated user/org first
  // This would come from your auth session
  // const session = await getSession();
  // if (session?.orgId) return `org:${session.orgId}`;
  
  // Fall back to IP address
  const forwardedFor = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0] || realIp || 'unknown';
  
  return `ip:${ip}`;
}

// Response helper for rate limited requests
export function rateLimitedResponse(
  remaining: number, 
  reset: number
): NextResponse {
  const retryAfter = reset - Math.floor(Date.now() / 1000);
  
  return NextResponse.json(
    {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      remaining,
      reset,
      retryAfter
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(1, retryAfter)),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(reset),
      }
    }
  );
}

// Idempotency key helper for Stripe and other operations
export function generateIdempotencyKey(namespace: string, payload: unknown): string {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 16);
  
  return `${namespace}:${hash}`;
}