/**
 * Cron Authentication Helper
 * 
 * Validates cron job requests using header-based secrets
 */

import { NextRequest } from 'next/server';

export class CronAuthError extends Error {
  constructor(message: string, public statusCode: number = 403) {
    super(message);
    this.name = 'CronAuthError';
  }
}

/**
 * Require valid cron authentication
 * Throws CronAuthError if authentication fails
 */
export function requireCron(req: NextRequest | Request, expectedSecret: string): void {
  if (!expectedSecret) {
    throw new CronAuthError('Cron secret not configured', 500);
  }

  // Check for authorization header
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    throw new CronAuthError('Missing authorization header', 401);
  }

  // Validate Bearer token format
  if (!authHeader.startsWith('Bearer ')) {
    throw new CronAuthError('Invalid authorization format', 401);
  }

  const token = authHeader.slice(7); // Remove "Bearer "
  
  // Timing-safe comparison
  if (!timingSafeEqual(token, expectedSecret)) {
    throw new CronAuthError('Invalid cron secret', 403);
  }

  // Authentication successful
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Middleware wrapper for cron routes
 */
export function withCronAuth(
  handler: (req: NextRequest) => Promise<Response>,
  secretKey: string = 'CRON_SECRET'
) {
  return async (req: NextRequest): Promise<Response> => {
    try {
      const secret = process.env[secretKey];
      if (!secret) {
        return new Response(
          JSON.stringify({ error: `${secretKey} environment variable not set` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      requireCron(req, secret);
      return await handler(req);
    } catch (error) {
      if (error instanceof CronAuthError) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            status: error.statusCode,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      console.error('Cron handler error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}

/**
 * Validate cron headers for Vercel Cron
 */
export function validateVercelCron(req: NextRequest): boolean {
  // Vercel Cron includes specific headers
  const cronHeader = req.headers.get('x-vercel-cron');
  const userAgent = req.headers.get('user-agent');
  
  return !!(cronHeader || (userAgent && userAgent.includes('vercel')));
}