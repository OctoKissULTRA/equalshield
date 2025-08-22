export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/server';
import { extractToken, hashToken, validateTokenAccess } from '@/lib/share';
import { getPublicReport } from '@/lib/reports/public';
import { generatePDF } from '@/lib/reports/pdf-generator';

/**
 * GET /api/reports/[scanId]/pdf
 * 
 * Generate and download PDF report for a scan
 * Supports both authenticated and token-based access
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { scanId: string } }
) {
  try {
    const { scanId } = params;
    const { searchParams } = new URL(req.url);
    const authHeader = req.headers.get('authorization');
    
    // Extract token from various sources
    const rawToken = extractToken(
      undefined, // No path token in this route
      authHeader,
      searchParams.get('t') || undefined
    );

    let hasAccess = false;
    let isSharedAccess = false;
    let reportData = null;

    // If token provided, validate token access
    if (rawToken) {
      const supabase = createSupabaseClient();
      const tokenHash = hashToken(rawToken);

      const { data: shareToken, error } = await supabase
        .from('share_tokens')
        .select(`
          id,
          org_id,
          scan_id,
          token_hash,
          expires_at,
          revoked_at,
          max_views,
          views
        `)
        .eq('token_hash', tokenHash)
        .eq('scan_id', scanId)
        .single();

      if (!error && shareToken) {
        const validation = validateTokenAccess(
          {
            expires_at: new Date(shareToken.expires_at),
            revoked_at: shareToken.revoked_at ? new Date(shareToken.revoked_at) : null,
            views: shareToken.views,
            max_views: shareToken.max_views,
            token_hash: shareToken.token_hash
          },
          rawToken
        );

        if (validation.valid) {
          hasAccess = true;
          isSharedAccess = true;
          
          // Increment view count
          try {
            await supabase
              .from('share_tokens')
              .update({ views: shareToken.views + 1 })
              .eq('id', shareToken.id);
          } catch (updateError) {
            console.error('Failed to increment PDF view count:', updateError);
          }
        }
      }
    } else {
      // TODO: Check authenticated user access
      // For now, we'll allow access if no token is provided
      // In production, this should verify the user owns the scan
      hasAccess = true;
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get report data
    reportData = await getPublicReport(scanId);
    
    if (!reportData) {
      return NextResponse.json(
        { error: 'Report not found or not completed' },
        { status: 404 }
      );
    }

    // Generate PDF
    const pdfBuffer = await generatePDF(reportData, {
      watermark: isSharedAccess, // Show watermark on shared reports
      title: `Accessibility Report - ${new URL(reportData.scan.url).hostname}`,
      includeDetails: !isSharedAccess // Include full details for authenticated users
    });

    // Set appropriate headers
    const filename = `accessibility-report-${new URL(reportData.scan.url).hostname}-${new Date().toISOString().split('T')[0]}.pdf`;
    
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'private, no-cache',
      },
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF report' },
      { status: 500 }
    );
  }
}