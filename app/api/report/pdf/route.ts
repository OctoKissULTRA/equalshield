export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/server';
import { chromium } from 'playwright';
import { requireUser } from '@/lib/auth/guards';
import { ScanResultsNormalizer, type NormalizedFinding } from '@/lib/scan-results';
import { generatePDFHTML, type PDFReportData } from '@/lib/reports/pdf-template';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Require authentication
    const user = await requireUser().catch(() => null);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const scanId = req.nextUrl.searchParams.get('scanId');
    
    if (!scanId || !/^[0-9a-f-]{36}$/i.test(scanId)) {
      return NextResponse.json(
        { error: 'Valid scan ID required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();

    // Get scan data with security check
    const { data: scanData, error: scanError } = await supabase
      .from('scans')
      .select(`
        id, url, created_at, status, org_id,
        organizations:org_id (name)
      `)
      .eq('id', scanId)
      .single();

    if (scanError || !scanData) {
      return NextResponse.json(
        { error: 'Scan not found' },
        { status: 404 }
      );
    }

    // TODO: Verify user has access to this org's scans
    // if (scanData.org_id !== user.orgId) {
    //   return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    // }

    if (scanData.status !== 'complete') {
      return NextResponse.json(
        { error: 'Scan not yet complete' },
        { status: 400 }
      );
    }

    // Get normalized findings
    const { data: findingsData, error: findingsError } = await supabase
      .from('scan_findings')
      .select('*')
      .eq('scan_id', scanId)
      .limit(500); // Limit to prevent memory issues

    if (findingsError) {
      console.error('Findings fetch error:', findingsError);
      return NextResponse.json(
        { error: 'Failed to fetch scan results' },
        { status: 500 }
      );
    }

    const findings = findingsData || [];
    
    // Generate analysis
    const score = ScanResultsNormalizer.calculateScanScore(findings);
    const quickWins = ScanResultsNormalizer.analyzeQuickWins(findings);
    const topIssues = ScanResultsNormalizer.generateTopIssuesReport(findings);
    
    const domain = new URL(scanData.url).hostname;
    
    const reportData: PDFReportData = {
      scan: {
        id: scanData.id,
        url: scanData.url,
        domain,
        timestamp: scanData.created_at,
        tier: 'free', // TODO: Get from user/org
        pageCount: 1 // TODO: Get actual page count
      },
      findings,
      score,
      summary: {
        totalViolations: findings.length,
        critical: findings.filter(f => f.impact === 'critical').length,
        serious: findings.filter(f => f.impact === 'serious').length,
        moderate: findings.filter(f => f.impact === 'moderate').length,
        minor: findings.filter(f => f.impact === 'minor').length,
        quickWins: quickWins.totalQuickWins,
        estimatedFixTime: quickWins.estimatedTime,
        topIssues: topIssues.issues.slice(0, 5).map(i => ({
          rule: i.rule,
          count: i.count,
          wcag: i.wcag
        }))
      },
      quickWins,
      topIssues
    };

    // Generate HTML
    const html = generatePDFHTML(reportData);

    // Convert to PDF with timeout and compression
    const browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    let pdf: Buffer;
    
    try {
      const page = await browser.newPage();
      
      // Set timeout for PDF generation (max 30s)
      page.setDefaultTimeout(30000);
      
      await page.setContent(html, { 
        waitUntil: 'networkidle',
        timeout: 15000 
      });
      
      // Add fonts for better typography
      await page.addStyleTag({
        content: `
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important; }
        `
      });
      
      pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
        displayHeaderFooter: false,
        tagged: true // For PDF accessibility
      });
      
    } finally {
      await browser.close();
    }

    const generationTime = Date.now() - startTime;
    console.log(`PDF generated in ${generationTime}ms for scan ${scanId}`);

    // Optimize filename
    const date = new Date(scanData.created_at).toISOString().split('T')[0];
    const filename = `accessibility-report-${domain}-${date}.pdf`
      .replace(/[^a-zA-Z0-9.-]/g, '-')
      .replace(/-+/g, '-');

    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdf.length.toString(),
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
        'X-Generation-Time': generationTime.toString()
      }
    });

  } catch (error) {
    const generationTime = Date.now() - startTime;
    console.error('PDF generation error:', error, `(${generationTime}ms)`);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF report',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}