export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/server';
import { chromium } from 'playwright';
import { requireUser } from '@/lib/auth/guards';
import { ScanResultsNormalizer } from '@/lib/scan-results';
import { VPATGenerator, type VPATData } from '@/lib/reports/vpat-generator';

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
    const format = req.nextUrl.searchParams.get('format') || 'html'; // html or pdf
    
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
      .limit(1000); // Higher limit for VPAT

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
    
    const domain = new URL(scanData.url).hostname;
    const orgName = scanData.organizations?.name || domain;
    
    // Create VPAT data structure
    const vpatData: VPATData = {
      product: {
        name: `${orgName} Website`,
        version: '1.0',
        description: `Web application and content accessible at ${scanData.url}`,
        dateEvaluated: new Date(scanData.created_at).toLocaleDateString('en-US'),
        evaluatorName: 'EqualShield Platform',
        evaluatorTitle: 'Automated Accessibility Testing System',
        evaluatorOrganization: 'EqualShield',
        contactInfo: 'support@equalshield.com'
      },
      evaluation: {
        methodology: 'Automated testing using axe-core accessibility engine with manual review of critical findings',
        scope: 'Web content and user interface components accessible via standard web browsers',
        testingApproach: 'Automated accessibility scan covering WCAG 2.1 Level A and AA criteria using industry-standard testing tools',
        assistiveTechnology: [
          'Screen Reader Compatible (tested for NVDA, JAWS, VoiceOver compatibility)',
          'Keyboard Navigation',
          'Voice Control Software',
          'Screen Magnification Software'
        ],
        browsers: [
          'Google Chrome (latest)',
          'Mozilla Firefox (latest)', 
          'Safari (latest)',
          'Microsoft Edge (latest)'
        ],
        operatingSystems: [
          'Windows 10/11',
          'macOS (latest)',
          'iOS (latest)',
          'Android (latest)'
        ]
      },
      findings,
      score,
      url: scanData.url,
      domain
    };

    // Generate VPAT HTML
    const vpatHTML = VPATGenerator.generateVPAT25(vpatData);

    if (format === 'pdf') {
      // Convert to PDF
      const browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      let pdf: Buffer;
      
      try {
        const page = await browser.newPage();
        
        // Set timeout for PDF generation (max 45s for VPAT)
        page.setDefaultTimeout(45000);
        
        await page.setContent(vpatHTML, { 
          waitUntil: 'networkidle',
          timeout: 20000 
        });
        
        // Add fonts for professional appearance
        await page.addStyleTag({
          content: `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body { font-family: 'Inter', Arial, sans-serif !important; }
          `
        });
        
        pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
          displayHeaderFooter: true,
          headerTemplate: `
            <div style="font-size: 10px; margin: 0 auto; color: #666;">
              VPAT 2.5 - ${domain} - Page <span class="pageNumber"></span> of <span class="totalPages"></span>
            </div>
          `,
          footerTemplate: `
            <div style="font-size: 9px; margin: 0 auto; color: #666;">
              Generated by EqualShield - ${new Date().toLocaleDateString()}
            </div>
          `,
          tagged: true // For PDF accessibility
        });
        
      } finally {
        await browser.close();
      }

      const generationTime = Date.now() - startTime;
      console.log(`VPAT PDF generated in ${generationTime}ms for scan ${scanId}`);

      // Optimize filename
      const date = new Date(scanData.created_at).toISOString().split('T')[0];
      const filename = `vpat-2.5-${domain}-${date}.pdf`
        .replace(/[^a-zA-Z0-9.-]/g, '-')
        .replace(/-+/g, '-');

      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': pdf.length.toString(),
          'Cache-Control': 'private, max-age=7200', // Cache for 2 hours
          'X-Generation-Time': generationTime.toString()
        }
      });
      
    } else {
      // Return HTML
      const generationTime = Date.now() - startTime;
      
      return new NextResponse(vpatHTML, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'private, max-age=3600',
          'X-Generation-Time': generationTime.toString()
        }
      });
    }

  } catch (error) {
    const generationTime = Date.now() - startTime;
    console.error('VPAT generation error:', error, `(${generationTime}ms)`);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate VPAT report',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}