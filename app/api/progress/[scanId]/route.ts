export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { progressTracker } from '@/lib/realtime/progress';

/**
 * GET /api/progress/[scanId]
 * 
 * Returns current progress for a specific scan
 * Supports both JSON and Server-Sent Events (SSE) for real-time updates
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { scanId: string } }
) {
  const { scanId } = params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format');

  // Handle Server-Sent Events for real-time updates
  if (format === 'sse') {
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      start(controller) {
        // Send initial progress
        const initialProgress = progressTracker.getScanProgress(scanId);
        if (initialProgress) {
          const data = `data: ${JSON.stringify(initialProgress)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }

        // Subscribe to updates
        const unsubscribe = progressTracker.subscribeScan(scanId, (progress) => {
          const data = `data: ${JSON.stringify(progress)}\n\n`;
          controller.enqueue(encoder.encode(data));
          
          // Close stream when scan is completed or failed
          if (['completed', 'failed'].includes(progress.status)) {
            setTimeout(() => {
              controller.close();
            }, 1000);
          }
        });

        // Handle client disconnect
        req.signal.addEventListener('abort', () => {
          unsubscribe();
          controller.close();
        });

        // Timeout after 10 minutes
        setTimeout(() => {
          unsubscribe();
          controller.close();
        }, 10 * 60 * 1000);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });
  }

  // Handle regular JSON request
  const progress = progressTracker.getScanProgress(scanId);
  
  if (!progress) {
    return NextResponse.json(
      { error: 'Scan not found or no longer active' },
      { status: 404 }
    );
  }

  return NextResponse.json(progress);
}

/**
 * POST /api/progress/[scanId]
 * 
 * Update scan progress (internal API for scanner workers)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { scanId: string } }
) {
  try {
    const { scanId } = params;
    const update = await req.json();

    // Validate required fields
    if (!update.status && !update.progress && !update.currentStep) {
      return NextResponse.json(
        { error: 'At least one update field required' },
        { status: 400 }
      );
    }

    // Update the progress
    progressTracker.updateScanProgress(scanId, update);

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Failed to update scan progress:', error);
    return NextResponse.json(
      { error: 'Failed to update progress' },
      { status: 500 }
    );
  }
}