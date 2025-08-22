/**
 * Secure Token Management for Shareable Report Links
 * 
 * Provides cryptographically secure token generation, hashing, and validation
 * for time-limited, revocable access to scan reports.
 */

import crypto from 'node:crypto';

/**
 * Generate a new cryptographically secure random token
 * 192-bit entropy (24 bytes) encoded as base64url for URL safety
 */
export function newRawToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Hash a raw token using SHA-256
 * Only the hash is stored in the database for security
 */
export function hashToken(raw: string): Buffer {
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

/**
 * Verify that a raw token matches a stored hash
 */
export function verifyToken(raw: string, storedHash: Buffer): boolean {
  const computedHash = hashToken(raw);
  return crypto.timingSafeEqual(computedHash, storedHash);
}

/**
 * Generate a secure sharing URL path
 */
export function generateShareUrl(rawToken: string): string {
  return `/r/${rawToken}`;
}

/**
 * Extract token from various formats
 * Supports URL path parameter, Authorization header, and query parameter
 */
export function extractToken(
  pathToken?: string,
  authHeader?: string,
  queryToken?: string
): string | null {
  // Try path parameter first (most common)
  if (pathToken && isValidTokenFormat(pathToken)) {
    return pathToken;
  }
  
  // Try Authorization header (Bearer token)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (isValidTokenFormat(token)) {
      return token;
    }
  }
  
  // Try query parameter (for direct links)
  if (queryToken && isValidTokenFormat(queryToken)) {
    return queryToken;
  }
  
  return null;
}

/**
 * Validate token format without checking database
 * Ensures token is base64url encoded and has correct length
 */
export function isValidTokenFormat(token: string): boolean {
  // Check if it's a valid base64url string of expected length
  // 24 bytes = 32 characters in base64url (192 bits)
  const base64urlPattern = /^[A-Za-z0-9_-]{32}$/;
  return base64urlPattern.test(token);
}

/**
 * Calculate expiration date from TTL in days
 */
export function calculateExpiration(ttlDays: number): Date {
  const maxTtl = 365; // Maximum 1 year
  const safeTtl = Math.min(Math.max(ttlDays, 1), maxTtl);
  return new Date(Date.now() + safeTtl * 24 * 60 * 60 * 1000);
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Check if view limit is exceeded
 */
export function isViewLimitExceeded(views: number, maxViews: number): boolean {
  return views >= maxViews;
}

/**
 * Sanitize and validate sharing parameters
 */
export interface ShareTokenParams {
  ttlDays: number;
  maxViews: number;
}

export function validateShareParams(params: Partial<ShareTokenParams>): ShareTokenParams {
  const ttlDays = Math.min(Math.max(params.ttlDays || 7, 1), 365); // 1 day to 1 year
  const maxViews = Math.min(Math.max(params.maxViews || 50, 1), 1000); // 1 to 1000 views
  
  return { ttlDays, maxViews };
}

/**
 * Generate a short description for a share token
 */
export function generateTokenDescription(ttlDays: number, maxViews: number): string {
  const expiryText = ttlDays === 1 ? '1 day' : `${ttlDays} days`;
  const viewText = maxViews === 1 ? '1 view' : `${maxViews} views`;
  return `Expires in ${expiryText}, ${viewText} max`;
}

/**
 * Check if token is valid for access
 */
export interface TokenValidationResult {
  valid: boolean;
  reason?: 'not_found' | 'expired' | 'revoked' | 'view_limit_exceeded' | 'hash_mismatch';
}

export function validateTokenAccess(
  token: {
    expires_at: Date;
    revoked_at?: Date | null;
    views: number;
    max_views: number;
    token_hash: Buffer;
  },
  rawToken: string
): TokenValidationResult {
  // Check if revoked
  if (token.revoked_at) {
    return { valid: false, reason: 'revoked' };
  }
  
  // Check if expired
  if (isTokenExpired(token.expires_at)) {
    return { valid: false, reason: 'expired' };
  }
  
  // Check view limit
  if (isViewLimitExceeded(token.views, token.max_views)) {
    return { valid: false, reason: 'view_limit_exceeded' };
  }
  
  // Verify token hash
  if (!verifyToken(rawToken, token.token_hash)) {
    return { valid: false, reason: 'hash_mismatch' };
  }
  
  return { valid: true };
}