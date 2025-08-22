import { NormalizedFinding, ScanScore } from '@/lib/scan-results';
import { sanitizeText } from '@/lib/security/sanitizer';

export interface VPATData {
  product: {
    name: string;
    version: string;
    description: string;
    dateEvaluated: string;
    evaluatorName: string;
    evaluatorTitle: string;
    evaluatorOrganization: string;
    contactInfo: string;
  };
  evaluation: {
    methodology: string;
    scope: string;
    testingApproach: string;
    assistiveTechnology: string[];
    browsers: string[];
    operatingSystems: string[];
  };
  findings: NormalizedFinding[];
  score: ScanScore;
  url: string;
  domain: string;
}

export interface VPATSection508Entry {
  criterion: string;
  conformanceLevel: 'Supports' | 'Partially Supports' | 'Does Not Support' | 'Not Applicable';
  remarks: string;
  wcagMapping?: string;
}

export interface VPATWCAGEntry {
  criterion: string;
  level: 'A' | 'AA' | 'AAA';
  conformanceLevel: 'Supports' | 'Partially Supports' | 'Does Not Support' | 'Not Applicable';
  remarks: string;
  findingsCount: number;
}

// Section 508 Chapter 5 criteria mapping
const SECTION_508_CRITERIA: Record<string, { title: string; wcag: string[] }> = {
  '501.1': {
    title: 'Scope',
    wcag: ['All WCAG criteria']
  },
  '502.2.1': {
    title: 'User Control of Audio',
    wcag: ['1.4.2']
  },
  '502.2.2': {
    title: 'Audio Description or Media Alternative',
    wcag: ['1.2.3', '1.2.5']
  },
  '502.3.1': {
    title: 'Captions (Prerecorded)',
    wcag: ['1.2.2']
  },
  '502.3.2': {
    title: 'Captions (Live)',
    wcag: ['1.2.4']
  },
  '502.4': {
    title: 'Audio Description (Prerecorded)',
    wcag: ['1.2.5']
  },
  '503.2': {
    title: 'User Preferences',
    wcag: ['1.4.4', '1.4.8', '1.4.10']
  },
  '503.3': {
    title: 'Alternative Access',
    wcag: ['2.1.1', '2.1.2', '2.1.4']
  },
  '503.4.1': {
    title: 'Caption Controls',
    wcag: ['1.2.2']
  },
  '503.4.2': {
    title: 'Audio Description Controls',
    wcag: ['1.2.5']
  },
  '504.2': {
    title: 'Content Creation or Editing',
    wcag: ['All applicable WCAG criteria']
  },
  '504.2.1': {
    title: 'Preservation of Information',
    wcag: ['4.1.1', '4.1.2']
  },
  '504.2.2': {
    title: 'PDF Export',
    wcag: ['All applicable WCAG criteria']
  },
  '504.3': {
    title: 'Prompts',
    wcag: ['3.3.2', '3.3.3']
  },
  '504.4': {
    title: 'Templates',
    wcag: ['All applicable WCAG criteria']
  }
};

// WCAG 2.1 Level A & AA criteria
const WCAG_CRITERIA: Record<string, { title: string; level: 'A' | 'AA' | 'AAA'; description: string }> = {
  '1.1.1': {
    title: 'Non-text Content',
    level: 'A',
    description: 'All non-text content has appropriate text alternatives'
  },
  '1.2.1': {
    title: 'Audio-only and Video-only (Prerecorded)',
    level: 'A',
    description: 'Time-based media alternatives for audio-only and video-only content'
  },
  '1.2.2': {
    title: 'Captions (Prerecorded)',
    level: 'A',
    description: 'Captions provided for prerecorded audio content in synchronized media'
  },
  '1.2.3': {
    title: 'Audio Description or Media Alternative (Prerecorded)',
    level: 'A',
    description: 'Audio description or full text alternative for prerecorded synchronized media'
  },
  '1.2.4': {
    title: 'Captions (Live)',
    level: 'AA',
    description: 'Captions provided for live audio content in synchronized media'
  },
  '1.2.5': {
    title: 'Audio Description (Prerecorded)',
    level: 'AA',
    description: 'Audio description provided for prerecorded synchronized media'
  },
  '1.3.1': {
    title: 'Info and Relationships',
    level: 'A',
    description: 'Information, structure, and relationships conveyed through presentation can be programmatically determined'
  },
  '1.3.2': {
    title: 'Meaningful Sequence',
    level: 'A',
    description: 'Content reading sequence is meaningful when presented sequentially'
  },
  '1.3.3': {
    title: 'Sensory Characteristics',
    level: 'A',
    description: 'Instructions do not rely solely on sensory characteristics'
  },
  '1.3.4': {
    title: 'Orientation',
    level: 'AA',
    description: 'Content does not restrict its view and operation to a single display orientation'
  },
  '1.3.5': {
    title: 'Identify Input Purpose',
    level: 'AA',
    description: 'Purpose of input fields can be programmatically determined'
  },
  '1.4.1': {
    title: 'Use of Color',
    level: 'A',
    description: 'Color is not used as the only visual means of conveying information'
  },
  '1.4.2': {
    title: 'Audio Control',
    level: 'A',
    description: 'Users can pause, stop, or control volume of audio that plays automatically'
  },
  '1.4.3': {
    title: 'Contrast (Minimum)',
    level: 'AA',
    description: 'Text has sufficient contrast ratio against its background'
  },
  '1.4.4': {
    title: 'Resize Text',
    level: 'AA',
    description: 'Text can be resized up to 200% without loss of content or functionality'
  },
  '1.4.5': {
    title: 'Images of Text',
    level: 'AA',
    description: 'Text is used rather than images of text except for customizable or essential images'
  },
  '1.4.10': {
    title: 'Reflow',
    level: 'AA',
    description: 'Content can be presented without horizontal scrolling at 320 CSS pixels width'
  },
  '1.4.11': {
    title: 'Non-text Contrast',
    level: 'AA',
    description: 'UI components and graphical objects have sufficient contrast'
  },
  '1.4.12': {
    title: 'Text Spacing',
    level: 'AA',
    description: 'Content is readable when text spacing properties are adjusted'
  },
  '1.4.13': {
    title: 'Content on Hover or Focus',
    level: 'AA',
    description: 'Additional content triggered by hover or focus is dismissible, hoverable, and persistent'
  },
  '2.1.1': {
    title: 'Keyboard',
    level: 'A',
    description: 'All functionality is available from a keyboard'
  },
  '2.1.2': {
    title: 'No Keyboard Trap',
    level: 'A',
    description: 'Focus can be moved away from any component using only a keyboard'
  },
  '2.1.4': {
    title: 'Character Key Shortcuts',
    level: 'A',
    description: 'Character key shortcuts can be turned off, remapped, or only active on focus'
  },
  '2.2.1': {
    title: 'Timing Adjustable',
    level: 'A',
    description: 'Users can adjust, extend, or turn off time limits'
  },
  '2.2.2': {
    title: 'Pause, Stop, Hide',
    level: 'A',
    description: 'Users can pause, stop, or hide moving, blinking, or auto-updating information'
  },
  '2.3.1': {
    title: 'Three Flashes or Below Threshold',
    level: 'A',
    description: 'Content does not contain more than three flashes per second'
  },
  '2.4.1': {
    title: 'Bypass Blocks',
    level: 'A',
    description: 'Mechanism available to bypass blocks of content repeated on multiple pages'
  },
  '2.4.2': {
    title: 'Page Titled',
    level: 'A',
    description: 'Web pages have titles that describe topic or purpose'
  },
  '2.4.3': {
    title: 'Focus Order',
    level: 'A',
    description: 'Focusable components receive focus in an order that preserves meaning'
  },
  '2.4.4': {
    title: 'Link Purpose (In Context)',
    level: 'A',
    description: 'Purpose of each link can be determined from link text or context'
  },
  '2.4.5': {
    title: 'Multiple Ways',
    level: 'AA',
    description: 'More than one way is available to locate a web page within a set of pages'
  },
  '2.4.6': {
    title: 'Headings and Labels',
    level: 'AA',
    description: 'Headings and labels describe topic or purpose'
  },
  '2.4.7': {
    title: 'Focus Visible',
    level: 'AA',
    description: 'Keyboard focus indicator is visible'
  },
  '2.5.1': {
    title: 'Pointer Gestures',
    level: 'A',
    description: 'Functionality that uses multipoint or path-based gestures has single-pointer alternative'
  },
  '2.5.2': {
    title: 'Pointer Cancellation',
    level: 'A',
    description: 'Functions executed on down-event can be aborted or undone'
  },
  '2.5.3': {
    title: 'Label in Name',
    level: 'A',
    description: 'Accessible name includes the text presented visually'
  },
  '2.5.4': {
    title: 'Motion Actuation',
    level: 'A',
    description: 'Functionality triggered by device motion has user interface alternative'
  },
  '3.1.1': {
    title: 'Language of Page',
    level: 'A',
    description: 'Default human language of web page can be programmatically determined'
  },
  '3.1.2': {
    title: 'Language of Parts',
    level: 'AA',
    description: 'Human language of each passage can be programmatically determined'
  },
  '3.2.1': {
    title: 'On Focus',
    level: 'A',
    description: 'Receiving focus does not initiate a change of context'
  },
  '3.2.2': {
    title: 'On Input',
    level: 'A',
    description: 'Changing the setting of a UI component does not automatically cause change of context'
  },
  '3.2.3': {
    title: 'Consistent Navigation',
    level: 'AA',
    description: 'Navigational mechanisms are used consistently'
  },
  '3.2.4': {
    title: 'Consistent Identification',
    level: 'AA',
    description: 'Components with same functionality are identified consistently'
  },
  '3.3.1': {
    title: 'Error Identification',
    level: 'A',
    description: 'Input errors are identified and described to the user in text'
  },
  '3.3.2': {
    title: 'Labels or Instructions',
    level: 'A',
    description: 'Labels or instructions are provided when content requires user input'
  },
  '3.3.3': {
    title: 'Error Suggestion',
    level: 'AA',
    description: 'Error suggestions are provided when input errors are detected'
  },
  '3.3.4': {
    title: 'Error Prevention (Legal, Financial, Data)',
    level: 'AA',
    description: 'Submissions are reversible, checked, or confirmed for important data'
  },
  '4.1.1': {
    title: 'Parsing',
    level: 'A',
    description: 'Markup is used according to specification'
  },
  '4.1.2': {
    title: 'Name, Role, Value',
    level: 'A',
    description: 'Name and role can be programmatically determined; states and values can be set'
  },
  '4.1.3': {
    title: 'Status Messages',
    level: 'AA',
    description: 'Status messages can be programmatically determined through role or properties'
  }
};

export class VPATGenerator {
  
  static generateVPAT25(data: VPATData): string {
    const sanitized = this.sanitizeData(data);
    
    return this.generateVPATHTML(sanitized);
  }
  
  private static sanitizeData(data: VPATData): VPATData {
    // Sanitize all user inputs to prevent XSS
    
    return {
      ...data,
      product: {
        name: sanitizeText(data.product.name),
        version: sanitizeText(data.product.version),
        description: sanitizeText(data.product.description),
        dateEvaluated: sanitizeText(data.product.dateEvaluated),
        evaluatorName: sanitizeText(data.product.evaluatorName),
        evaluatorTitle: sanitizeText(data.product.evaluatorTitle),
        evaluatorOrganization: sanitizeText(data.product.evaluatorOrganization),
        contactInfo: sanitizeText(data.product.contactInfo)
      },
      evaluation: {
        methodology: sanitizeText(data.evaluation.methodology),
        scope: sanitizeText(data.evaluation.scope),
        testingApproach: sanitizeText(data.evaluation.testingApproach),
        assistiveTechnology: data.evaluation.assistiveTechnology.map(sanitizeText),
        browsers: data.evaluation.browsers.map(sanitizeText),
        operatingSystems: data.evaluation.operatingSystems.map(sanitizeText)
      },
      url: sanitizeText(data.url),
      domain: sanitizeText(data.domain),
      findings: data.findings,
      score: data.score
    };
  }
  
  private static generateSection508Table(findings: NormalizedFinding[]): VPATSection508Entry[] {
    const entries: VPATSection508Entry[] = [];
    
    Object.entries(SECTION_508_CRITERIA).forEach(([criterion, info]) => {
      const relatedFindings = findings.filter(f => 
        info.wcag.includes(f.wcagCriterion) || info.wcag.includes('All WCAG criteria') || info.wcag.includes('All applicable WCAG criteria')
      );
      
      const conformanceLevel = this.determineConformanceLevel(relatedFindings, criterion);
      const remarks = this.generateSection508Remarks(relatedFindings, info.title, criterion);
      
      entries.push({
        criterion,
        conformanceLevel,
        remarks,
        wcagMapping: info.wcag.join(', ')
      });
    });
    
    return entries;
  }
  
  private static generateWCAGTable(findings: NormalizedFinding[]): VPATWCAGEntry[] {
    const entries: VPATWCAGEntry[] = [];
    
    Object.entries(WCAG_CRITERIA).forEach(([criterion, info]) => {
      if (info.level === 'A' || info.level === 'AA') {
        const criterionFindings = findings.filter(f => f.wcagCriterion === criterion);
        const conformanceLevel = this.determineWCAGConformanceLevel(criterionFindings);
        const remarks = this.generateWCAGRemarks(criterionFindings, info.description);
        
        entries.push({
          criterion,
          level: info.level,
          conformanceLevel,
          remarks,
          findingsCount: criterionFindings.length
        });
      }
    });
    
    return entries.sort((a, b) => a.criterion.localeCompare(b.criterion));
  }
  
  private static determineConformanceLevel(findings: NormalizedFinding[], criterion: string): VPATSection508Entry['conformanceLevel'] {
    if (findings.length === 0) {
      // Check if criterion is applicable to web content
      const webApplicableCriteria = ['502.2.1', '502.2.2', '502.3.1', '502.3.2', '502.4', '503.4.1', '503.4.2'];
      if (!webApplicableCriteria.includes(criterion)) {
        return 'Not Applicable';
      }
      return 'Supports';
    }
    
    const criticalOrSerious = findings.filter(f => ['critical', 'serious'].includes(f.impact));
    
    if (criticalOrSerious.length > 0) {
      return 'Does Not Support';
    } else if (findings.length > 0) {
      return 'Partially Supports';
    } else {
      return 'Supports';
    }
  }
  
  private static determineWCAGConformanceLevel(findings: NormalizedFinding[]): VPATWCAGEntry['conformanceLevel'] {
    if (findings.length === 0) {
      return 'Supports';
    }
    
    const blocking = findings.filter(f => ['critical', 'serious'].includes(f.impact));
    
    if (blocking.length > 0) {
      return 'Does Not Support';
    } else {
      return 'Partially Supports';
    }
  }
  
  private static generateSection508Remarks(findings: NormalizedFinding[], title: string, criterion: string): string {
    if (findings.length === 0) {
      if (['502.2.1', '502.2.2', '502.3.1', '502.3.2', '502.4', '503.4.1', '503.4.2'].includes(criterion)) {
        return 'No audio or video content identified during testing.';
      }
      return `All requirements for ${title} are met.`;
    }
    
    const blocking = findings.filter(f => ['critical', 'serious'].includes(f.impact));
    const moderate = findings.filter(f => f.impact === 'moderate');
    const minor = findings.filter(f => f.impact === 'minor');
    
    let remarks = '';
    
    if (blocking.length > 0) {
      remarks += `${blocking.length} blocking issue${blocking.length > 1 ? 's' : ''} identified. `;
      remarks += `Primary concerns: ${blocking.slice(0, 3).map(f => f.description.split('.')[0]).join('; ')}. `;
    }
    
    if (moderate.length > 0) {
      remarks += `${moderate.length} moderate issue${moderate.length > 1 ? 's' : ''} requiring attention. `;
    }
    
    if (minor.length > 0) {
      remarks += `${minor.length} minor enhancement${minor.length > 1 ? 's' : ''} recommended. `;
    }
    
    return remarks.trim();
  }
  
  private static generateWCAGRemarks(findings: NormalizedFinding[], description: string): string {
    if (findings.length === 0) {
      return `Criterion is satisfied. ${description}`;
    }
    
    const blocking = findings.filter(f => ['critical', 'serious'].includes(f.impact));
    
    if (blocking.length > 0) {
      const topIssues = blocking.slice(0, 2).map(f => f.ruleId).join(', ');
      return `${findings.length} violation${findings.length > 1 ? 's' : ''} found (${blocking.length} blocking). Primary issues: ${topIssues}. ${description}`;
    } else {
      return `${findings.length} minor violation${findings.length > 1 ? 's' : ''} found. Issues can be addressed without blocking accessibility. ${description}`;
    }
  }
  
  private static generateVPATHTML(data: VPATData): string {
    const section508Entries = this.generateSection508Table(data.findings);
    const wcagEntries = this.generateWCAGTable(data.findings);
    
    const overallConformance = this.calculateOverallConformance(data.score);
    const executiveSummary = this.generateExecutiveSummary(data);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VPAT 2.5 Report - ${data.product.name}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 40px;
      color: #333;
      background: white;
    }
    
    h1 { 
      color: #2d5953; 
      border-bottom: 3px solid #d4c4a0; 
      padding-bottom: 10px;
      font-size: 28px;
    }
    
    h2 { 
      color: #2d5953; 
      margin-top: 30px;
      font-size: 22px;
      border-left: 4px solid #2d5953;
      padding-left: 15px;
    }
    
    h3 { 
      color: #4a5568; 
      margin-top: 25px;
      font-size: 18px;
    }
    
    .header-info {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #2d5953;
    }
    
    .conformance-summary {
      background: linear-gradient(135deg, #2d5953 0%, #d4c4a0 100%);
      color: white;
      padding: 25px;
      border-radius: 8px;
      margin: 25px 0;
      text-align: center;
    }
    
    .conformance-summary h3 {
      color: white;
      margin: 0 0 15px 0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 14px;
    }
    
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
      vertical-align: top;
    }
    
    th {
      background-color: #2d5953;
      color: white;
      font-weight: 600;
    }
    
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    
    .supports { background-color: #d4edda; }
    .partially-supports { background-color: #fff3cd; }
    .does-not-support { background-color: #f8d7da; }
    .not-applicable { background-color: #e2e3e5; }
    
    .criterion-col { width: 15%; font-weight: 600; }
    .level-col { width: 10%; text-align: center; }
    .conformance-col { width: 20%; text-align: center; font-weight: 600; }
    .remarks-col { width: 55%; }
    
    .page-break { page-break-before: always; }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #2d5953;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
    
    .executive-summary {
      background: #f0fff4;
      border: 1px solid #c3e6cb;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    
    .score-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    
    .score-card {
      background: white;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 15px;
      text-align: center;
    }
    
    .score-value {
      font-size: 24px;
      font-weight: bold;
      margin: 5px 0;
    }
    
    .score-label {
      font-size: 12px;
      text-transform: uppercase;
      color: #666;
      font-weight: 600;
    }
    
    @media print {
      body { margin: 20px; font-size: 12px; }
      .page-break { page-break-before: always; }
      table { font-size: 11px; }
      th, td { padding: 8px; }
    }
  </style>
</head>
<body>
  <h1>Voluntary Product Accessibility Template (VPAT®) 2.5</h1>
  
  <div class="header-info">
    <h3>Product Information</h3>
    <p><strong>Product Name:</strong> ${data.product.name}</p>
    <p><strong>Product Version:</strong> ${data.product.version}</p>
    <p><strong>Product Description:</strong> ${data.product.description}</p>
    <p><strong>Date of Evaluation:</strong> ${data.product.dateEvaluated}</p>
    <p><strong>Contact Information:</strong> ${data.product.contactInfo}</p>
  </div>
  
  <div class="header-info">
    <h3>Evaluation Information</h3>
    <p><strong>Evaluator:</strong> ${data.product.evaluatorName}, ${data.product.evaluatorTitle}</p>
    <p><strong>Organization:</strong> ${data.product.evaluatorOrganization}</p>
    <p><strong>Testing Methodology:</strong> ${data.evaluation.methodology}</p>
    <p><strong>Evaluation Scope:</strong> ${data.evaluation.scope}</p>
    <p><strong>Testing Approach:</strong> ${data.evaluation.testingApproach}</p>
    <p><strong>Assistive Technology:</strong> ${data.evaluation.assistiveTechnology.join(', ')}</p>
    <p><strong>Browsers Tested:</strong> ${data.evaluation.browsers.join(', ')}</p>
    <p><strong>Operating Systems:</strong> ${data.evaluation.operatingSystems.join(', ')}</p>
  </div>
  
  <div class="conformance-summary">
    <h3>Overall Conformance Level</h3>
    <p style="font-size: 20px; margin: 0;"><strong>${overallConformance}</strong></p>
    <p style="margin: 10px 0 0 0;">Based on WCAG 2.1 Level AA standards</p>
  </div>
  
  <div class="executive-summary">
    <h3>Executive Summary</h3>
    ${executiveSummary}
  </div>
  
  <div class="score-grid">
    <div class="score-card">
      <div class="score-label">Overall Score</div>
      <div class="score-value" style="color: ${data.score.overall >= 80 ? '#38a169' : data.score.overall >= 60 ? '#d69e2e' : '#e53e3e'}">${data.score.overall}</div>
    </div>
    <div class="score-card">
      <div class="score-label">WCAG A Compliance</div>
      <div class="score-value" style="color: ${data.score.compliance.wcagA ? '#38a169' : '#e53e3e'}">${data.score.compliance.wcagA ? 'PASS' : 'FAIL'}</div>
    </div>
    <div class="score-card">
      <div class="score-label">WCAG AA Compliance</div>
      <div class="score-value" style="color: ${data.score.compliance.wcagAA ? '#38a169' : '#e53e3e'}">${data.score.compliance.wcagAA ? 'PASS' : 'FAIL'}</div>
    </div>
    <div class="score-card">
      <div class="score-label">Total Violations</div>
      <div class="score-value" style="color: #4a5568">${data.findings.length}</div>
    </div>
  </div>
  
  <div class="page-break"></div>
  
  <h2>Section 508 Chapter 5 – Software</h2>
  <p>Notes: The criteria below only apply to software that is assistive technology or has a user interface. Web-based software is evaluated using WCAG 2.1 criteria.</p>
  
  <table>
    <thead>
      <tr>
        <th class="criterion-col">Criteria</th>
        <th class="conformance-col">Conformance Level</th>
        <th class="remarks-col">Remarks and Explanations</th>
      </tr>
    </thead>
    <tbody>
      ${section508Entries.map(entry => `
        <tr>
          <td class="criterion-col">
            <strong>${entry.criterion}</strong><br>
            ${SECTION_508_CRITERIA[entry.criterion]?.title || ''}
            ${entry.wcagMapping ? `<br><em>Maps to: ${entry.wcagMapping}</em>` : ''}
          </td>
          <td class="conformance-col ${entry.conformanceLevel.toLowerCase().replace(/ /g, '-')}">${entry.conformanceLevel}</td>
          <td class="remarks-col">${entry.remarks}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div class="page-break"></div>
  
  <h2>WCAG 2.1 Level A & AA (Web Content Accessibility Guidelines)</h2>
  <p>Notes: The criteria below apply to web content and web-based applications.</p>
  
  <table>
    <thead>
      <tr>
        <th class="criterion-col">Criteria</th>
        <th class="level-col">Level</th>
        <th class="conformance-col">Conformance Level</th>
        <th class="remarks-col">Remarks and Explanations</th>
      </tr>
    </thead>
    <tbody>
      ${wcagEntries.map(entry => `
        <tr>
          <td class="criterion-col">
            <strong>${entry.criterion}</strong><br>
            ${WCAG_CRITERIA[entry.criterion]?.title || ''}
          </td>
          <td class="level-col">${entry.level}</td>
          <td class="conformance-col ${entry.conformanceLevel.toLowerCase().replace(/ /g, '-')}">${entry.conformanceLevel}</td>
          <td class="remarks-col">${entry.remarks}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div class="footer">
    <p><strong>EqualShield VPAT Generator</strong> | Generated: ${new Date().toLocaleDateString()}</p>
    <p>This VPAT was generated using automated accessibility testing tools and manual evaluation.</p>
    <p>For questions about this evaluation, contact: ${data.product.contactInfo}</p>
  </div>
</body>
</html>`;
  }
  
  private static calculateOverallConformance(score: ScanScore): string {
    if (score.compliance.wcagAA) {
      return 'WCAG 2.1 Level AA Conformant';
    } else if (score.compliance.wcagA) {
      return 'WCAG 2.1 Level A Conformant';
    } else {
      return 'Non-Conformant (with exceptions noted)';
    }
  }
  
  private static generateExecutiveSummary(data: VPATData): string {
    const totalFindings = data.findings.length;
    const blocking = data.findings.filter(f => ['critical', 'serious'].includes(f.impact)).length;
    const quickWins = data.findings.filter(f => f.quickWin).length;
    
    let summary = `<p>This accessibility evaluation assessed <strong>${data.product.name}</strong> against WCAG 2.1 Level A and AA standards. `;
    
    if (totalFindings === 0) {
      summary += `No accessibility violations were identified during testing. The product demonstrates strong accessibility compliance.</p>`;
    } else {
      summary += `A total of <strong>${totalFindings} accessibility issue${totalFindings > 1 ? 's' : ''}</strong> ${totalFindings > 1 ? 'were' : 'was'} identified.</p>`;
      
      if (blocking > 0) {
        summary += `<p><strong>Critical Findings:</strong> ${blocking} issue${blocking > 1 ? 's' : ''} ${blocking > 1 ? 'require' : 'requires'} immediate attention as ${blocking > 1 ? 'they' : 'it'} significantly impact${blocking === 1 ? 's' : ''} users with disabilities and pose legal compliance risks.</p>`;
      }
      
      if (quickWins > 0) {
        summary += `<p><strong>Quick Wins:</strong> ${quickWins} issue${quickWins > 1 ? 's' : ''} can be resolved with minimal effort, providing immediate accessibility improvements.</p>`;
      }
      
      summary += `<p><strong>Overall Assessment:</strong> `;
      if (data.score.overall >= 80) {
        summary += `The product demonstrates good accessibility posture with minor improvements needed.`;
      } else if (data.score.overall >= 60) {
        summary += `The product has moderate accessibility barriers that should be addressed systematically.`;
      } else {
        summary += `The product has significant accessibility barriers requiring comprehensive remediation.`;
      }
      summary += `</p>`;
    }
    
    summary += `<p><strong>Recommendation:</strong> ${this.generateRecommendation(data.score, blocking, quickWins)}</p>`;
    
    return summary;
  }
  
  private static generateRecommendation(score: ScanScore, blocking: number, quickWins: number): string {
    if (score.overall >= 90) {
      return 'Continue current accessibility practices and conduct periodic reviews to maintain compliance.';
    } else if (score.overall >= 80) {
      return 'Address identified issues and implement accessibility testing in development workflow.';
    } else if (blocking > 0) {
      return `Immediately remediate ${blocking} critical issue${blocking > 1 ? 's' : ''}, then systematically address remaining violations. Consider engaging accessibility experts for guidance.`;
    } else if (quickWins > 0) {
      return `Start with ${quickWins} quick win${quickWins > 1 ? 's' : ''} to achieve immediate improvements, then develop comprehensive remediation plan.`;
    } else {
      return 'Develop comprehensive accessibility remediation plan with clear timelines and responsibilities.';
    }
  }
}