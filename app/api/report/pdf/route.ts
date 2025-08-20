import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { scans, violations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { chromium } from 'playwright';

function generateReportHTML(scan: any, scanViolations: any[]) {
  const criticalCount = scanViolations.filter(v => v.severity === 'critical').length;
  const seriousCount = scanViolations.filter(v => v.severity === 'serious').length;
  const moderateCount = scanViolations.filter(v => v.severity === 'moderate').length;
  const minorCount = scanViolations.filter(v => v.severity === 'minor').length;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ADA Compliance Report - ${scan.domain}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background: white;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 60px 40px;
      text-align: center;
      page-break-after: avoid;
    }
    
    .header h1 {
      font-size: 36px;
      margin-bottom: 10px;
      font-weight: 700;
    }
    
    .header .subtitle {
      font-size: 18px;
      opacity: 0.95;
    }
    
    .header .date {
      margin-top: 20px;
      font-size: 14px;
      opacity: 0.9;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    
    .executive-summary {
      background: #f8f9fa;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 40px;
      border-left: 4px solid #667eea;
    }
    
    .executive-summary h2 {
      color: #667eea;
      margin-bottom: 20px;
      font-size: 24px;
    }
    
    .risk-level {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      margin: 10px 0;
    }
    
    .risk-high {
      background: #fee2e2;
      color: #dc2626;
    }
    
    .risk-medium {
      background: #fef3c7;
      color: #d97706;
    }
    
    .risk-low {
      background: #d1fae5;
      color: #059669;
    }
    
    .scores {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin: 40px 0;
    }
    
    .score-card {
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    
    .score-card .value {
      font-size: 36px;
      font-weight: bold;
      margin: 10px 0;
    }
    
    .score-card .label {
      color: #6b7280;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .score-good { color: #059669; }
    .score-warning { color: #d97706; }
    .score-bad { color: #dc2626; }
    
    .violations-summary {
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 30px;
      margin: 40px 0;
    }
    
    .violations-summary h2 {
      margin-bottom: 20px;
      color: #1a1a1a;
    }
    
    .violation-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-top: 20px;
    }
    
    .stat-item {
      display: flex;
      justify-content: space-between;
      padding: 12px;
      background: #f9fafb;
      border-radius: 8px;
    }
    
    .stat-label {
      font-weight: 500;
    }
    
    .stat-value {
      font-weight: bold;
      padding: 2px 8px;
      border-radius: 4px;
      background: white;
    }
    
    .critical { color: #dc2626; }
    .serious { color: #ea580c; }
    .moderate { color: #d97706; }
    .minor { color: #84cc16; }
    
    .violations-list {
      margin-top: 40px;
    }
    
    .violations-list h2 {
      margin-bottom: 20px;
      color: #1a1a1a;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 10px;
    }
    
    .violation-item {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    
    .violation-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    
    .violation-title {
      font-weight: 600;
      font-size: 16px;
    }
    
    .severity-badge {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .severity-critical {
      background: #fee2e2;
      color: #dc2626;
    }
    
    .severity-serious {
      background: #fed7aa;
      color: #ea580c;
    }
    
    .severity-moderate {
      background: #fef3c7;
      color: #d97706;
    }
    
    .severity-minor {
      background: #ecfccb;
      color: #84cc16;
    }
    
    .violation-details {
      color: #4b5563;
      margin: 10px 0;
    }
    
    .fix-section {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 15px;
      margin-top: 15px;
    }
    
    .fix-section h4 {
      color: #059669;
      margin-bottom: 10px;
      font-size: 14px;
      text-transform: uppercase;
    }
    
    .fix-code {
      background: #1e293b;
      color: #e2e8f0;
      padding: 12px;
      border-radius: 4px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 12px;
      overflow-x: auto;
      margin-top: 10px;
    }
    
    .legal-disclaimer {
      background: #fef2f2;
      border: 2px solid #fecaca;
      border-radius: 8px;
      padding: 20px;
      margin-top: 40px;
      page-break-inside: avoid;
    }
    
    .legal-disclaimer h3 {
      color: #dc2626;
      margin-bottom: 10px;
    }
    
    .legal-disclaimer p {
      color: #7f1d1d;
      font-size: 14px;
      line-height: 1.6;
    }
    
    .footer {
      text-align: center;
      color: #6b7280;
      font-size: 12px;
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    
    @media print {
      .header {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .violation-item {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>ADA Compliance Report</h1>
    <div class="subtitle">${scan.domain}</div>
    <div class="date">Generated: ${new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}</div>
  </div>

  <div class="container">
    <div class="executive-summary">
      <h2>Executive Summary</h2>
      <p>This automated accessibility audit identified <strong>${scan.totalViolations || 0} potential violations</strong> 
      of WCAG 2.1 Level AA standards on ${scan.domain}.</p>
      
      <div class="risk-level ${scan.adaRiskScore > 70 ? 'risk-high' : scan.adaRiskScore > 40 ? 'risk-medium' : 'risk-low'}">
        Legal Risk Level: ${scan.adaRiskScore > 70 ? 'HIGH' : scan.adaRiskScore > 40 ? 'MEDIUM' : 'LOW'}
      </div>
      
      <p style="margin-top: 20px;">
        ${scan.adaRiskScore > 70 
          ? 'Immediate action recommended. The violations found pose significant legal risk and should be addressed urgently.'
          : scan.adaRiskScore > 40
          ? 'Several accessibility issues were found that should be addressed to reduce legal risk and improve user experience.'
          : 'Minor accessibility issues were found. While legal risk is low, addressing these will improve overall accessibility.'}
      </p>
    </div>

    <div class="scores">
      <div class="score-card">
        <div class="label">WCAG Score</div>
        <div class="value ${scan.wcagScore >= 80 ? 'score-good' : scan.wcagScore >= 60 ? 'score-warning' : 'score-bad'}">
          ${scan.wcagScore || 0}
        </div>
      </div>
      
      <div class="score-card">
        <div class="label">ADA Risk Score</div>
        <div class="value ${scan.adaRiskScore <= 30 ? 'score-good' : scan.adaRiskScore <= 60 ? 'score-warning' : 'score-bad'}">
          ${scan.adaRiskScore || 0}
        </div>
      </div>
      
      <div class="score-card">
        <div class="label">Lawsuit Probability</div>
        <div class="value ${scan.lawsuitProbability <= 30 ? 'score-good' : scan.lawsuitProbability <= 60 ? 'score-warning' : 'score-bad'}">
          ${scan.lawsuitProbability || 0}%
        </div>
      </div>
    </div>

    <div class="violations-summary">
      <h2>Violations Summary</h2>
      <div class="violation-stats">
        <div class="stat-item">
          <span class="stat-label">Critical Violations</span>
          <span class="stat-value critical">${criticalCount}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Serious Violations</span>
          <span class="stat-value serious">${seriousCount}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Moderate Violations</span>
          <span class="stat-value moderate">${moderateCount}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Minor Violations</span>
          <span class="stat-value minor">${minorCount}</span>
        </div>
      </div>
    </div>

    <div class="violations-list">
      <h2>Detailed Violations</h2>
      
      ${scanViolations.slice(0, 20).map(v => `
        <div class="violation-item">
          <div class="violation-header">
            <div class="violation-title">WCAG ${v.wcagCriterion} Violation</div>
            <span class="severity-badge severity-${v.severity}">${v.severity}</span>
          </div>
          
          <div class="violation-details">
            <p><strong>Impact:</strong> ${v.userImpact}</p>
            <p><strong>Element:</strong> ${v.elementType || 'Unknown'}</p>
            ${v.businessImpact ? `<p><strong>Business Impact:</strong> ${v.businessImpact}</p>` : ''}
          </div>
          
          <div class="fix-section">
            <h4>How to Fix</h4>
            <p>${v.fixDescription}</p>
            ${v.fixCode ? `<div class="fix-code">${v.fixCode}</div>` : ''}
            <p style="margin-top: 10px; font-size: 14px; color: #6b7280;">
              Estimated time to fix: ${v.estimatedFixTime || '15 minutes'}
            </p>
          </div>
        </div>
      `).join('')}
      
      ${scanViolations.length > 20 ? `
        <p style="text-align: center; color: #6b7280; margin-top: 20px;">
          ... and ${scanViolations.length - 20} more violations. View full report online.
        </p>
      ` : ''}
    </div>

    <div class="legal-disclaimer">
      <h3>Important Legal Disclaimer</h3>
      <p>
        This automated report is provided for informational purposes only and does not constitute legal advice. 
        While we strive for accuracy, automated testing cannot catch all accessibility issues. 
        Manual testing and consultation with accessibility experts is recommended for comprehensive compliance.
        EqualShield and its affiliates are not responsible for any legal consequences arising from reliance on this report.
      </p>
    </div>

    <div class="footer">
      <p>© ${new Date().getFullYear()} EqualShield - Professional ADA Compliance Platform</p>
      <p>Report generated automatically. For questions, contact support@equalshield.com</p>
    </div>
  </div>
</body>
</html>
  `;
}

export async function GET(req: NextRequest) {
  try {
    const scanId = req.nextUrl.searchParams.get('scanId');
    
    if (!scanId) {
      return NextResponse.json(
        { error: 'Scan ID is required' },
        { status: 400 }
      );
    }

    // Get scan data
    const [scanData] = await db
      .select()
      .from(scans)
      .where(eq(scans.id, parseInt(scanId)))
      .limit(1);

    if (!scanData) {
      return NextResponse.json(
        { error: 'Scan not found' },
        { status: 404 }
      );
    }

    // Get violations
    const scanViolations = await db
      .select()
      .from(violations)
      .where(eq(violations.scanId, parseInt(scanId)));

    // Generate HTML report
    const html = generateReportHTML(scanData, scanViolations);

    // Convert to PDF using Playwright
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });
    
    await browser.close();

    // Return PDF
    return new NextResponse(pdf as Buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ada-report-${scanData.domain}-${new Date().toISOString().split('T')[0]}.pdf"`
      }
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF report' },
      { status: 500 }
    );
  }
}