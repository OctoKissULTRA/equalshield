import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { scans, teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Simple rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 5;

  const current = rateLimitMap.get(identifier);
  if (!current || now > current.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const { url, email, tier = 'free' } = await req.json();
    
    // Validate inputs
    if (!url || !email) {
      return NextResponse.json(
        { error: 'URL and email are required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitKey = `${clientIP}:${email}`;
    
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in 1 minute.' },
        { status: 429 }
      );
    }

    // Get or create organization
    const domain = new URL(url).hostname;
    
    let orgResult = await db.select().from(teams).where(eq(teams.stripeCustomerId, email)).limit(1);
    let orgId: number;
    
    if (orgResult.length === 0) {
      const newOrg = await db.insert(teams).values({
        name: domain,
        planName: tier,
        stripeCustomerId: email // Using for email temporarily
      }).returning({ id: teams.id });
      
      orgId = newOrg[0].id;
    } else {
      orgId = orgResult[0].id;
    }

    // Create scan with 'pending' status - worker will pick it up
    const scanResult = await db.insert(scans).values({
      teamId: orgId,
      url,
      email,
      domain,
      status: 'pending' // Worker polls for 'pending' status
    }).returning({ id: scans.id });

    const scanId = scanResult[0].id;

    // Return immediately - worker will process async
    return NextResponse.json({
      success: true,
      scanId: scanId,
      message: 'Scan queued successfully. Results will be ready in ~30 seconds.',
      resultsUrl: `/scan/${scanId}`,
      estimatedTime: tier === 'enterprise' ? '45 seconds' : '30 seconds'
    });

  } catch (error) {
    console.error('Scan API error:', error);
    return NextResponse.json(
      { error: 'Failed to queue scan. Please try again.' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    mode: 'queue-only',
    workerUrl: process.env.SCAN_WORKER_URL || 'polling-based'
  });
}