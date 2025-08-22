import { NormalizedFinding, QuickWinsAnalysis, TopIssuesReport } from '@/lib/scan-results';
import { sanitizeText, sanitizeCode } from '@/lib/security/sanitizer';

export interface PDFReportData {
  scan: {
    id: string;
    url: string;
    domain: string;
    timestamp: string;
    tier: string;
    pageCount: number;
  };
  findings: NormalizedFinding[];
  score: {
    overall: number;
    perceivable: number;
    operable: number;
    understandable: number;
    robust: number;
    compliance: { wcagA: boolean; wcagAA: boolean; wcagAAA: boolean };
  };
  summary: {
    totalViolations: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    quickWins: number;
    estimatedFixTime: string;
    topIssues: Array<{ rule: string; count: number; wcag: string }>;
  };
  quickWins: QuickWinsAnalysis;
  topIssues: TopIssuesReport;
}

// Sanitization functions imported from security module

function getRiskLevel(score: number): { level: string; class: string; description: string } {
  if (score >= 80) return {
    level: 'LOW',
    class: 'risk-low',
    description: 'Good accessibility posture with minor issues to address.'
  };
  if (score >= 60) return {
    level: 'MEDIUM', 
    class: 'risk-medium',
    description: 'Several accessibility barriers present. Action recommended.'
  };
  return {
    level: 'HIGH',
    class: 'risk-high', 
    description: 'Significant accessibility barriers. Immediate action required.'
  };
}

export function generatePDFHTML(data: PDFReportData): string {
  const { scan, findings, score, summary, quickWins, topIssues } = data;
  
  // Sanitize all inputs
  const safeDomain = sanitizeText(scan.domain);
  const safeUrl = sanitizeText(scan.url);
  const reportDate = new Date(scan.timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
  
  const risk = getRiskLevel(score.overall);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessibility Report - ${safeDomain}</title>
  <style>
    /* Reset and base styles */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #1a202c;
      background: #ffffff;
      font-size: 14px;
    }
    
    /* Typography scale */
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 12px; }
    h2 { font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #2d3748; }
    h3 { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #2d3748; }
    h4 { font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #4a5568; }
    
    p { margin-bottom: 12px; }
    
    /* Layout */
    .page { 
      max-width: 210mm; 
      margin: 0 auto; 
      padding: 20mm;
      min-height: 297mm;
      page-break-after: always;
    }
    
    .page:last-child { page-break-after: avoid; }
    
    /* Header */
    .report-header {
      background: linear-gradient(135deg, #2d5953 0%, #d4c4a0 100%);
      color: white;
      padding: 40px 30px;
      margin: -20mm -20mm 30px -20mm;
      text-align: center;
    }
    
    .report-header h1 { margin-bottom: 8px; }
    .report-header .url { font-size: 16px; opacity: 0.9; margin-bottom: 20px; }
    .report-header .meta { font-size: 12px; opacity: 0.8; }
    
    /* Executive Summary */
    .executive-summary {
      background: #f7fafc;
      border-left: 4px solid #2d5953;
      padding: 24px;
      margin-bottom: 32px;
      border-radius: 8px;
    }
    
    .risk-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 12px 0;
    }
    
    .risk-low { background: #c6f6d5; color: #22543d; }
    .risk-medium { background: #fed7aa; color: #c05621; }
    .risk-high { background: #fed7d7; color: #c53030; }
    
    /* Score Grid */
    .score-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 16px;
      margin: 24px 0;
    }
    
    .score-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    
    .score-value {
      font-size: 32px;
      font-weight: 700;
      margin: 8px 0;
    }
    
    .score-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #718096;
      font-weight: 600;
    }
    
    .score-excellent { color: #38a169; }
    .score-good { color: #3182ce; }
    .score-warning { color: #d69e2e; }
    .score-poor { color: #e53e3e; }
    
    /* WCAG Principles */
    .wcag-principles {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin: 24px 0;
    }
    
    .principle-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }
    
    .principle-score {
      font-size: 24px;
      font-weight: 700;
      margin-left: 8px;
    }
    
    /* Summary Stats */
    .summary-stats {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    
    .stat-item {
      text-align: center;
      padding: 12px;
      background: #f7fafc;
      border-radius: 6px;
    }
    
    .stat-value {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    
    .stat-label {
      font-size: 12px;
      color: #718096;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .critical { color: #e53e3e; }
    .serious { color: #dd6b20; }
    .moderate { color: #d69e2e; }
    .minor { color: #38a169; }
    
    /* Quick Wins */
    .quick-wins {
      background: #f0fff4;
      border: 1px solid #9ae6b4;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }
    
    .quick-wins h3 { color: #22543d; }
    
    .quick-wins-list {
      list-style: none;
      margin-top: 16px;
    }
    
    .quick-wins-list li {
      padding: 8px 0;
      border-bottom: 1px solid #c6f6d5;
      display: flex;
      justify-content: space-between;
    }
    
    .quick-wins-list li:last-child { border-bottom: none; }
    
    /* Top Issues */
    .top-issues {
      margin: 32px 0;
    }
    
    .issue-item {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    
    .issue-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    
    .issue-title { 
      font-weight: 600; 
      font-size: 16px;
      color: #2d3748;
    }
    
    .wcag-badge {
      background: #edf2f7;
      color: #4a5568;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .impact-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .impact-critical { background: #fed7d7; color: #c53030; }
    .impact-serious { background: #fed7aa; color: #c05621; }
    .impact-moderate { background: #faf089; color: #b7791f; }
    .impact-minor { background: #c6f6d5; color: #22543d; }
    
    .issue-details {
      color: #4a5568;
      margin: 12px 0;
      line-height: 1.6;
    }
    
    .issue-count {
      font-weight: 600;
      color: #e53e3e;
    }
    
    /* Remediation */
    .remediation {
      background: #f0fff4;
      border: 1px solid #9ae6b4;
      border-radius: 6px;
      padding: 16px;
      margin-top: 16px;
    }
    
    .remediation h4 { 
      color: #22543d; 
      margin-bottom: 8px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .remediation-code {
      background: #1a202c;
      color: #e2e8f0;
      padding: 12px;
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 11px;
      overflow-x: auto;
      margin: 8px 0;
      white-space: pre;
    }
    
    .effort-badge {
      background: #edf2f7;
      color: #4a5568;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    /* Footer */
    .report-footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      color: #718096;
      font-size: 12px;
    }
    
    .disclaimer {
      background: #fffaf0;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
      page-break-inside: avoid;
    }
    
    .disclaimer h4 { color: #c05621; margin-bottom: 12px; }
    .disclaimer p { color: #744210; font-size: 13px; line-height: 1.6; }
    
    /* Print styles */
    @media print {
      body { font-size: 12px; }
      .page { margin: 0; padding: 15mm; min-height: auto; }
      .report-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .issue-item { break-inside: avoid; }
      .quick-wins { break-inside: avoid; }
      .disclaimer { break-inside: avoid; }
      .page-break { page-break-before: always; }
    }
    
    /* Accessibility */
    .sr-only { 
      position: absolute; 
      width: 1px; 
      height: 1px; 
      padding: 0; 
      margin: -1px; 
      overflow: hidden; 
      clip: rect(0,0,0,0); 
      white-space: nowrap; 
      border: 0; 
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Report Header -->
    <header class="report-header">
      <h1>Accessibility Compliance Report</h1>
      <div class="url">${safeUrl}</div>
      <div class="meta">
        Generated: ${reportDate} | Pages Scanned: ${scan.pageCount} | Tier: ${scan.tier.toUpperCase()}
      </div>
    </header>
    
    <!-- Executive Summary -->
    <section class="executive-summary">
      <h2>Executive Summary</h2>
      <p>This accessibility audit analyzed <strong>${scan.pageCount} page${scan.pageCount !== 1 ? 's' : ''}</strong> 
      and identified <strong>${summary.totalViolations} accessibility issue${summary.totalViolations !== 1 ? 's' : ''}</strong> 
      across WCAG 2.1 Level A and AA standards.</p>
      
      <div class="risk-badge ${risk.class}">
        Risk Level: ${risk.level}
      </div>
      
      <p>${risk.description}</p>
    </section>
    
    <!-- Overall Score -->
    <section class="score-grid">
      <div class="score-card">
        <div class="score-label">Overall Score</div>
        <div class="score-value ${score.overall >= 80 ? 'score-excellent' : score.overall >= 60 ? 'score-good' : score.overall >= 40 ? 'score-warning' : 'score-poor'}">
          ${score.overall}
        </div>
      </div>
      
      <div class="score-card">
        <div class="score-label">WCAG A</div>
        <div class="score-value ${score.compliance.wcagA ? 'score-excellent' : 'score-poor'}">
          ${score.compliance.wcagA ? 'PASS' : 'FAIL'}
        </div>
      </div>
      
      <div class="score-card">
        <div class="score-label">WCAG AA</div>
        <div class="score-value ${score.compliance.wcagAA ? 'score-excellent' : 'score-poor'}">
          ${score.compliance.wcagAA ? 'PASS' : 'FAIL'}
        </div>
      </div>
      
      <div class="score-card">
        <div class="score-label">Quick Wins</div>
        <div class="score-value score-good">
          ${summary.quickWins}
        </div>
      </div>
    </section>
    
    <!-- WCAG Principles Breakdown -->
    <section class="wcag-principles">
      <div class="principle-card">
        <h4>🎯 Perceivable <span class="principle-score ${score.perceivable >= 70 ? 'score-good' : 'score-warning'}">${score.perceivable}</span></h4>
        <p>Information must be presentable in ways users can perceive</p>
      </div>
      <div class="principle-card">
        <h4>⚡ Operable <span class="principle-score ${score.operable >= 70 ? 'score-good' : 'score-warning'}">${score.operable}</span></h4>
        <p>Interface components must be operable by all users</p>
      </div>
      <div class="principle-card">
        <h4>🧠 Understandable <span class="principle-score ${score.understandable >= 70 ? 'score-good' : 'score-warning'}">${score.understandable}</span></h4>
        <p>Information and UI operation must be understandable</p>
      </div>
      <div class="principle-card">
        <h4>🛡️ Robust <span class="principle-score ${score.robust >= 70 ? 'score-good' : 'score-warning'}">${score.robust}</span></h4>
        <p>Content must be robust enough for various assistive technologies</p>
      </div>
    </section>
    
    <!-- Violations Summary -->
    <section class="summary-stats">
      <h3>Violations Breakdown</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value critical">${summary.critical}</div>
          <div class="stat-label">Critical</div>
        </div>
        <div class="stat-item">
          <div class="stat-value serious">${summary.serious}</div>
          <div class="stat-label">Serious</div>
        </div>
        <div class="stat-item">
          <div class="stat-value moderate">${summary.moderate}</div>
          <div class="stat-label">Moderate</div>
        </div>
        <div class="stat-item">
          <div class="stat-value minor">${summary.minor}</div>
          <div class="stat-label">Minor</div>
        </div>
      </div>
      <p style="margin-top: 16px; text-align: center; color: #4a5568;">
        Estimated total fix time: <strong>${summary.estimatedFixTime}</strong>
      </p>
    </section>
  </div>
  
  <!-- Quick Wins Page -->
  <div class="page">
    <section class="quick-wins">
      <h2>🚀 Quick Wins (${quickWins.totalQuickWins} opportunities)</h2>
      <p>These high-impact, low-effort fixes can improve your score by up to <strong>${quickWins.potentialScoreGain} points</strong> 
      in approximately <strong>${quickWins.estimatedTime}</strong>.</p>
      
      <ul class="quick-wins-list">
        ${quickWins.priorityFixes.map(fix => `
          <li>
            <span>
              <strong>${sanitizeText(fix.rule)}</strong> (${fix.count} instances)
              <div style="font-size: 12px; color: #718096;">WCAG criterion varies by rule</div>
            </span>
            <span>
              <div style="text-align: right;">
                <div style="font-weight: 600; color: #38a169;">+${fix.scoreGain} points</div>
                <div style="font-size: 12px; color: #718096;">${fix.estimatedTime}</div>
              </div>
            </span>
          </li>
        `).join('')}
      </ul>
    </section>
    
    <!-- Top Issues -->
    <section class="top-issues">
      <h2>🎯 Priority Issues</h2>
      <p>Focus on these issues first - they have the highest impact on user experience and legal compliance.</p>
      
      ${topIssues.issues.slice(0, 8).map(issue => `
        <div class="issue-item">
          <div class="issue-header">
            <div class="issue-title">${sanitizeText(issue.rule)}</div>
            <div>
              <span class="wcag-badge">WCAG ${sanitizeText(issue.wcag)}</span>
              <span class="impact-badge impact-${issue.impact}">${sanitizeText(issue.impact)}</span>
            </div>
          </div>
          
          <div class="issue-details">
            <p><strong>Occurrences:</strong> <span class="issue-count">${issue.count}</span> instances found</p>
            <p><strong>Impact:</strong> ${sanitizeText(issue.description)}</p>
            <p><strong>Legal Risk:</strong> ${sanitizeText(issue.legalRisk).toUpperCase()}</p>
            <p><strong>Business Case:</strong> ${sanitizeText(issue.businessJustification)}</p>
          </div>
          
          ${findings.find(f => f.ruleId === issue.rule)?.remediation ? `
            <div class="remediation">
              <h4>🔧 How to Fix</h4>
              <p>${sanitizeText(findings.find(f => f.ruleId === issue.rule)!.remediation.description)}</p>
              <div class="remediation-code">${sanitizeCode(findings.find(f => f.ruleId === issue.rule)!.remediation.code)}</div>
              <p style="margin-top: 8px; font-size: 12px;">
                <span class="effort-badge">Effort: ${findings.find(f => f.ruleId === issue.rule)!.remediation.effort}</span>
              </p>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </section>
  </div>
  
  <!-- Final Page -->
  <div class="page">
    <section class="disclaimer">
      <h4>⚖️ Legal Disclaimer</h4>
      <p>This automated accessibility report is provided for informational purposes only and does not constitute legal advice. 
      While our scanning technology follows industry best practices, automated testing cannot identify all accessibility barriers. 
      We recommend manual testing and consultation with accessibility experts for comprehensive compliance validation.</p>
      <p style="margin-top: 12px;">EqualShield and its affiliates assume no liability for legal consequences arising from reliance on this report. 
      This report should be used as a starting point for accessibility improvements, not as definitive proof of compliance.</p>
    </section>
    
    <footer class="report-footer">
      <div style="margin-bottom: 16px;">
        <strong>EqualShield</strong> - Professional Accessibility Compliance Platform
      </div>
      <div>Report ID: ${scan.id} | Generated: ${reportDate}</div>
      <div style="margin-top: 8px;">
        Questions? Contact support@equalshield.com | Learn more at equalshield.com
      </div>
    </footer>
  </div>
</body>
</html>`;
}