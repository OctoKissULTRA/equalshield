/**
 * In-Memory Rate Limiting for Trial System
 * 
 * Simple rate limiting implementation for demonstration.
 * In production, use Redis with Upstash or similar.
 */

interface RateLimitRecord {
  requests: number;
  resetTime: number;
}

// In-memory storage (will reset when server restarts)
// In production, use Redis: new Map() -> Redis client
const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup expired records every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

/**
 * Check rate limit using sliding window
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number = 24 * 60 * 60 * 1000 // 24 hours
): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
}> {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  // No existing record or expired window
  if (!record || now > record.resetTime) {
    const newRecord: RateLimitRecord = {
      requests: 1,
      resetTime: now + windowMs
    };
    rateLimitStore.set(key, newRecord);
    
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime: newRecord.resetTime
    };
  }

  // Existing record within window
  if (record.requests >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime
    };
  }

  // Increment and allow
  record.requests++;
  rateLimitStore.set(key, record);

  return {
    allowed: true,
    remaining: limit - record.requests,
    resetTime: record.resetTime
  };
}

/**
 * Get current rate limit status without incrementing
 */
export async function getRateLimitStatus(key: string, limit: number): Promise<{
  requests: number;
  remaining: number;
  resetTime: number;
}> {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    return {
      requests: 0,
      remaining: limit,
      resetTime: now + 24 * 60 * 60 * 1000
    };
  }

  return {
    requests: record.requests,
    remaining: Math.max(0, limit - record.requests),
    resetTime: record.resetTime
  };
}

/**
 * Trial-specific rate limiting keys
 */
export function getTrialRateLimitKey(ip: string, type: 'ip' | 'domain' = 'ip', domain?: string): string {
  if (type === 'domain' && domain) {
    return `trial:domain:${domain}`;
  }
  return `trial:ip:${ip}`;
}

/**
 * Check trial rate limits with multiple keys
 */
export async function checkTrialRateLimit(
  ip: string,
  domain?: string
): Promise<{
  allowed: boolean;
  limitType?: 'ip' | 'domain';
  resetTime?: number;
  remaining?: number;
}> {
  // Check IP-based limit (10 per day)
  const ipKey = getTrialRateLimitKey(ip, 'ip');
  const ipCheck = await checkRateLimit(ipKey, 10);

  if (!ipCheck.allowed) {
    return {
      allowed: false,
      limitType: 'ip',
      resetTime: ipCheck.resetTime,
      remaining: ipCheck.remaining
    };
  }

  // Check domain-based limit if domain provided (5 per day)
  if (domain) {
    const domainKey = getTrialRateLimitKey(ip, 'domain', domain);
    const domainCheck = await checkRateLimit(domainKey, 5);

    if (!domainCheck.allowed) {
      return {
        allowed: false,
        limitType: 'domain',
        resetTime: domainCheck.resetTime,
        remaining: domainCheck.remaining
      };
    }
  }

  return { allowed: true };
}

/**
 * Rate limiting middleware for Express-style APIs
 */
export function createRateLimitMiddleware(
  keyFn: (req: any) => string,
  limit: number,
  windowMs: number = 60 * 60 * 1000
) {
  return async (req: any, res: any, next: any) => {
    try {
      const key = keyFn(req);
      const result = await checkRateLimit(key, limit, windowMs);

      // Add rate limit headers
      res.headers = {
        ...res.headers,
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString()
      };

      if (!result.allowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
      }

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Fail open - allow request if rate limiting fails
      next();
    }
  };
}