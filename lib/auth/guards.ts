import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { cookies } from 'next/headers';

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
  orgId?: string;
  teamId?: number;
}

// Server-side auth check (not middleware-only)
export async function requireUser(req?: NextRequest): Promise<AuthUser> {
  const user = await getUser();
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  return {
    id: String(user.id),
    email: user.email || '',
    role: (user as any).role || 'user',
    orgId: (user as any).orgId,
    teamId: user.teamId || undefined,
  };
}

// Admin-only endpoint guard
export async function requireAdmin(req?: NextRequest): Promise<AuthUser> {
  const user = await requireUser(req);
  
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    // Log security event
    console.error(`[SECURITY] Non-admin user ${user.id} attempted to access admin endpoint`);
    throw new Error('Admin access required');
  }
  
  return user;
}

// Organization member check
export async function requireOrgMember(orgId: string, req?: NextRequest): Promise<AuthUser> {
  const user = await requireUser(req);
  
  if (user.orgId !== orgId && user.role !== 'super_admin') {
    console.error(`[SECURITY] User ${user.id} attempted to access org ${orgId} without membership`);
    throw new Error('Organization membership required');
  }
  
  return user;
}

// Audit log helper
export async function logAdminAction(
  user: AuthUser,
  action: string,
  resourceType?: string,
  resourceId?: string,
  metadata?: Record<string, any>
) {
  // This should write to audit_logs table
  const auditEntry = {
    userId: user.id,
    orgId: user.orgId,
    action,
    resourceType,
    resourceId,
    metadata,
    timestamp: new Date().toISOString(),
  };
  
  console.log('[AUDIT]', JSON.stringify(auditEntry));
  
  // TODO: Write to database
  // await db.insert(auditLogs).values(auditEntry);
}

// Response helpers
export function unauthorizedResponse(message = 'Authentication required'): NextResponse {
  return NextResponse.json(
    { error: 'Unauthorized', message },
    { status: 401 }
  );
}

export function forbiddenResponse(message = 'Access denied'): NextResponse {
  return NextResponse.json(
    { error: 'Forbidden', message },
    { status: 403 }
  );
}