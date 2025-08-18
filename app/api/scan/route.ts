import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { scans } from '@/lib/db/schema';
import { scanWebsite } from '@/lib/scanner';

export async function POST(request: NextRequest) {
  try {
    const { url, email } = await request.json();

    if (!url || !email) {
      return NextResponse.json(
        { error: 'URL and email are required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Create initial scan record
    const [scanRecord] = await db.insert(scans).values({
      url,
      email,
      status: 'pending'
    }).returning();

    // Start scanning in background (in production, use a job queue)
    performScan(scanRecord.id, url, email).catch(console.error);

    return NextResponse.json({
      scanId: scanRecord.id,
      status: 'pending',
      message: 'Scan initiated successfully'
    });

  } catch (error) {
    console.error('Scan API error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate scan' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scanId = searchParams.get('id');

  if (!scanId) {
    return NextResponse.json(
      { error: 'Scan ID is required' },
      { status: 400 }
    );
  }

  try {
    const [scanRecord] = await db
      .select()
      .from(scans)
      .where(eq(scans.id, parseInt(scanId)))
      .limit(1);

    if (!scanRecord) {
      return NextResponse.json(
        { error: 'Scan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(scanRecord);

  } catch (error) {
    console.error('Scan fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scan results' },
      { status: 500 }
    );
  }
}

async function performScan(scanId: number, url: string, email: string) {
  try {
    // Update status to scanning
    await db.update(scans)
      .set({ status: 'scanning' })
      .where(eq(scans.id, scanId));

    // Perform the actual scan
    const scanResult = await scanWebsite(url);

    // Update scan record with results
    await db.update(scans)
      .set({
        status: 'completed',
        overallScore: scanResult.overallScore,
        wcagLevel: scanResult.wcagLevel,
        criticalIssues: scanResult.criticalIssues,
        majorIssues: scanResult.majorIssues,
        minorIssues: scanResult.minorIssues,
        results: scanResult.results,
        completedAt: new Date()
      })
      .where(eq(scans.id, scanId));

    console.log(`Scan ${scanId} completed successfully`);

  } catch (error) {
    console.error(`Scan ${scanId} failed:`, error);
    
    // Update status to failed
    await db.update(scans)
      .set({ 
        status: 'failed',
        completedAt: new Date()
      })
      .where(eq(scans.id, scanId));
  }
}

// Import eq function
import { eq } from 'drizzle-orm';