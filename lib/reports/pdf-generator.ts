/**
 * PDF Report Generator
 * 
 * Generates professional PDF reports from accessibility scan data
 */

import { PublicReportData } from './public';

export interface PDFGenerationOptions {
  watermark?: boolean;
  title?: string;
  includeDetails?: boolean;
  branding?: {
    logo?: string;
    color?: string;
    footer?: string;
  };
}

/**
 * Generate a PDF report from scan data
 * This is a simplified implementation - in production you'd use a proper PDF library
 */
export async function generatePDF(
  reportData: PublicReportData,
  options: PDFGenerationOptions = {}
): Promise<Buffer> {
  try {
    // For now, we'll create a simple HTML version and convert to PDF
    // In production, use a library like Puppeteer, jsPDF, or PDFKit
    
    const html = generateHTMLReport(reportData, options);
    
    // Simulate PDF generation delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For demo purposes, return the HTML as a "PDF"
    // In production, use actual PDF generation:
    // const pdf = await generatePDFFromHTML(html);
    // return pdf;
    
    return Buffer.from(html, 'utf-8');
    
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error('Failed to generate PDF report');
  }
}

function generateHTMLReport(
  reportData: PublicReportData,
  options: PDFGenerationOptions
): string {
  const { watermark = false, title, includeDetails = true } = options;
  
  const domain = new URL(reportData.scan.url).hostname;
  const reportTitle = title || `Accessibility Report - ${domain}`;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      ${watermark ? `
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23e0e0e0" font-size="24" transform="rotate(-45 200 200)">EqualShield Demo</text></svg>');
        background-repeat: repeat;
        background-size: 200px 200px;
      ` : ''}
    }
    
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding: 30px 0;
      border-bottom: 3px solid #2563eb;
    }
    
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 10px;
    }
    
    .title {
      font-size: 28px;
      font-weight: bold;
      margin: 20px 0;
      color: #1f2937;
    }
    
    .subtitle {
      font-size: 16px;
      color: #6b7280;
      margin-bottom: 10px;
    }
    
    .score-section {
      background: #f8fafc;
      padding: 30px;
      border-radius: 12px;
      margin: 30px 0;
      text-align: center;
    }
    
    .score-circle {
      display: inline-block;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: conic-gradient(#10b981 ${reportData.summary.overall_score * 3.6}deg, #e5e7eb 0deg);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 20px auto;
      position: relative;
    }
    
    .score-inner {
      width: 90px;
      height: 90px;
      background: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    
    .summary-item {
      background: white;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      text-align: center;
    }
    
    .summary-item h3 {
      margin: 0 0 10px 0;
      color: #374151;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .summary-item .value {
      font-size: 24px;
      font-weight: bold;
      color: #1f2937;
    }
    
    .violations-section {
      margin: 40px 0;
    }
    
    .violation-item {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin: 15px 0;
    }
    
    .violation-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    
    .violation-title {
      font-weight: bold;
      color: #1f2937;
    }
    
    .impact-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
    }
    
    .impact-critical { background: #fee2e2; color: #991b1b; }
    .impact-serious { background: #fed7aa; color: #9a3412; }
    .impact-moderate { background: #fef3c7; color: #92400e; }
    .impact-minor { background: #dbeafe; color: #1e40af; }
    
    .footer {
      margin-top: 60px;
      padding-top: 30px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
    
    .disclaimer {
      background: #f3f4f6;
      padding: 20px;
      border-radius: 8px;
      margin: 30px 0;
      font-size: 14px;
      color: #374151;
    }
    
    @media print {
      body {
        background: white !important;
      }
      
      .score-circle {
        border: 4px solid #10b981;
        background: white !important;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🛡️ EqualShield</div>
    <h1 class="title">${reportTitle}</h1>
    <div class="subtitle">${reportData.scan.url}</div>
    <div class="subtitle">Generated on ${new Date(reportData.metadata.generated_at).toLocaleDateString()}</div>
  </div>
  
  <div class="score-section">
    <h2>Overall Accessibility Score</h2>
    <div class="score-circle">
      <div class="score-inner">${reportData.summary.overall_score}%</div>
    </div>
    <p><strong>${reportData.summary.wcag_level}</strong></p>
  </div>
  
  <div class="summary-grid">
    <div class="summary-item">
      <h3>Total Issues</h3>
      <div class="value">${reportData.summary.total_violations}</div>
    </div>
    <div class="summary-item">
      <h3>Critical Issues</h3>
      <div class="value" style="color: #dc2626;">${reportData.summary.critical_issues}</div>
    </div>
    <div class="summary-item">
      <h3>Major Issues</h3>
      <div class="value" style="color: #ea580c;">${reportData.summary.major_issues}</div>
    </div>
    <div class="summary-item">
      <h3>Pages Scanned</h3>
      <div class="value">${reportData.metadata.pages_analyzed}</div>
    </div>
  </div>
  
  <div class="violations-section">
    <h2>Top Accessibility Issues</h2>
    ${reportData.violations.slice(0, includeDetails ? 10 : 5).map(violation => `
      <div class="violation-item">
        <div class="violation-header">
          <span class="violation-title">${violation.criterion}</span>
          <span class="impact-badge impact-${violation.impact}">${violation.impact}</span>
        </div>
        <p>${violation.description}</p>
        <p><strong>${violation.instances}</strong> instances found across <strong>${violation.page_count}</strong> page${violation.page_count !== 1 ? 's' : ''}</p>
      </div>
    `).join('')}
  </div>
  
  <div class="disclaimer">
    <h3>Important Disclaimer</h3>
    <p>
      This report provides technical guidance for WCAG 2.1 compliance based on automated testing. 
      Automated testing identifies common accessibility barriers but may not catch all issues. 
      Manual review and user testing are recommended for comprehensive accessibility evaluation.
    </p>
    <p>
      <strong>This report does not constitute legal advice.</strong> Consult with accessibility 
      and legal experts for compliance guidance specific to your jurisdiction and requirements.
    </p>
  </div>
  
  <div class="footer">
    <p>Generated by EqualShield Accessibility Platform</p>
    <p>For questions about this report, visit equalshield.com</p>
    ${watermark ? '<p><em>Demo Report - Watermarked</em></p>' : ''}
  </div>
</body>
</html>
  `.trim();
}