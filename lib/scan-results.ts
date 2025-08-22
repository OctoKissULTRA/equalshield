import { AxeResults } from 'axe-core';

export interface NormalizedFinding {
  id: string;
  scanId: string;
  ruleId: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  wcagCriterion: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  severity: number; // 1-4 numeric
  description: string;
  help: string;
  helpUrl: string;
  selector: string;
  snippet: string;
  pageUrl: string;
  elementType: string;
  legalRisk: 'high' | 'medium' | 'low';
  quickWin: boolean;
  estimatedFixTime: string;
  category: 'perceivable' | 'operable' | 'understandable' | 'robust';
  businessImpact: string;
  userImpact: string;
  remediation: {
    code: string;
    description: string;
    effort: 'low' | 'medium' | 'high';
  };
}

export interface ScanScore {
  overall: number; // 0-100
  perceivable: number;
  operable: number;
  understandable: number;
  robust: number;
  compliance: {
    wcagA: boolean;
    wcagAA: boolean;
    wcagAAA: boolean;
  };
  trends: {
    improvement: number; // vs last scan
    direction: 'improving' | 'declining' | 'stable';
  };
}

export interface QuickWinsAnalysis {
  totalQuickWins: number;
  estimatedTime: string;
  potentialScoreGain: number;
  priorityFixes: Array<{
    rule: string;
    count: number;
    impact: string;
    estimatedTime: string;
    scoreGain: number;
  }>;
}

export interface TopIssuesReport {
  issues: Array<{
    rule: string;
    wcag: string;
    count: number;
    impact: string;
    legalRisk: string;
    description: string;
    businessJustification: string;
  }>;
  summary: {
    totalUniqueIssues: number;
    criticalCount: number;
    highLegalRisk: number;
    averageFixTime: string;
  };
}

// WCAG Rule mappings with comprehensive metadata
const WCAG_RULE_MAP: Record<string, {
  wcag: string;
  level: 'A' | 'AA' | 'AAA';
  category: 'perceivable' | 'operable' | 'understandable' | 'robust';
  legalRisk: 'high' | 'medium' | 'low';
  quickWin: boolean;
  businessImpact: string;
  userImpact: string;
}> = {
  'image-alt': {
    wcag: '1.1.1',
    level: 'A',
    category: 'perceivable',
    legalRisk: 'high',
    quickWin: true,
    businessImpact: 'Critical for SEO and legal compliance',
    userImpact: 'Screen reader users cannot understand images'
  },
  'color-contrast': {
    wcag: '1.4.3',
    level: 'AA',
    category: 'perceivable',
    legalRisk: 'high',
    quickWin: false,
    businessImpact: 'Most common ADA lawsuit trigger',
    userImpact: 'Users with low vision cannot read text'
  },
  'label': {
    wcag: '3.3.2',
    level: 'A',
    category: 'understandable',
    legalRisk: 'high',
    quickWin: true,
    businessImpact: 'Blocks form submissions and conversions',
    userImpact: 'Screen reader users cannot fill forms'
  },
  'link-name': {
    wcag: '2.4.4',
    level: 'A',
    category: 'operable',
    legalRisk: 'high',
    quickWin: true,
    businessImpact: 'Poor SEO and navigation UX',
    userImpact: 'Users cannot understand link purpose'
  },
  'button-name': {
    wcag: '4.1.2',
    level: 'A',
    category: 'robust',
    legalRisk: 'high',
    quickWin: true,
    businessImpact: 'Breaks critical user interactions',
    userImpact: 'Screen reader users cannot use buttons'
  },
  'heading-order': {
    wcag: '1.3.1',
    level: 'A',
    category: 'perceivable',
    legalRisk: 'medium',
    quickWin: true,
    businessImpact: 'SEO penalties and poor navigation',
    userImpact: 'Confusing page structure for all users'
  },
  'landmark-unique': {
    wcag: '1.3.6',
    level: 'AA',
    category: 'perceivable',
    legalRisk: 'medium',
    quickWin: true,
    businessImpact: 'Moderate SEO impact',
    userImpact: 'Navigation confusion for screen readers'
  },
  'keyboard': {
    wcag: '2.1.1',
    level: 'A',
    category: 'operable',
    legalRisk: 'high',
    quickWin: false,
    businessImpact: 'Excludes keyboard-only users entirely',
    userImpact: 'Complete inability to use interactive elements'
  },
  'focus-order': {
    wcag: '2.4.3',
    level: 'A',
    category: 'operable',
    legalRisk: 'medium',
    quickWin: false,
    businessImpact: 'Poor UX for keyboard navigation',
    userImpact: 'Confusing navigation flow'
  },
  'skip-link': {
    wcag: '2.4.1',
    level: 'A',
    category: 'operable',
    legalRisk: 'medium',
    quickWin: true,
    businessImpact: 'Minor UX improvement',
    userImpact: 'Slower navigation for keyboard users'
  }
};

export class ScanResultsNormalizer {
  
  static normalizeAxeResults(axeResults: AxeResults, scanId: string, pageUrl: string): NormalizedFinding[] {
    const findings: NormalizedFinding[] = [];
    
    for (const violation of axeResults.violations) {
      const metadata = WCAG_RULE_MAP[violation.id] || this.getDefaultMetadata(violation.id);
      
      for (const node of violation.nodes) {
        findings.push({
          id: `${scanId}-${violation.id}-${findings.length}`,
          scanId,
          ruleId: violation.id,
          impact: this.mapAxeImpact(violation.impact),
          wcagCriterion: metadata.wcag,
          wcagLevel: metadata.level,
          severity: this.impactToNumeric(violation.impact),
          description: violation.description,
          help: violation.help,
          helpUrl: violation.helpUrl,
          selector: node.target.join(' '),
          snippet: node.html,
          pageUrl,
          elementType: this.extractElementType(node.html),
          legalRisk: metadata.legalRisk,
          quickWin: metadata.quickWin,
          estimatedFixTime: this.estimateFixTime(violation.id, metadata.quickWin),
          category: metadata.category,
          businessImpact: metadata.businessImpact,
          userImpact: metadata.userImpact,
          remediation: this.generateRemediation(violation.id, node.html)
        });
      }
    }
    
    return findings;
  }
  
  static calculateScanScore(findings: NormalizedFinding[], previousScore?: number): ScanScore {
    const categoryScores = {
      perceivable: this.calculateCategoryScore(findings, 'perceivable'),
      operable: this.calculateCategoryScore(findings, 'operable'),
      understandable: this.calculateCategoryScore(findings, 'understandable'),
      robust: this.calculateCategoryScore(findings, 'robust')
    };
    
    const overall = Math.round(
      (categoryScores.perceivable + categoryScores.operable + 
       categoryScores.understandable + categoryScores.robust) / 4
    );
    
    const wcagAViolations = findings.filter(f => f.wcagLevel === 'A' && f.severity >= 3);
    const wcagAAViolations = findings.filter(f => ['A', 'AA'].includes(f.wcagLevel) && f.severity >= 3);
    
    return {
      overall,
      ...categoryScores,
      compliance: {
        wcagA: wcagAViolations.length === 0,
        wcagAA: wcagAAViolations.length === 0,
        wcagAAA: findings.filter(f => f.severity >= 3).length === 0
      },
      trends: {
        improvement: previousScore ? overall - previousScore : 0,
        direction: previousScore ? 
          (overall > previousScore ? 'improving' : overall < previousScore ? 'declining' : 'stable') : 
          'stable'
      }
    };
  }
  
  static analyzeQuickWins(findings: NormalizedFinding[]): QuickWinsAnalysis {
    const quickWins = findings.filter(f => f.quickWin);
    const grouped = this.groupByRule(quickWins);
    
    const priorityFixes = Object.entries(grouped)
      .map(([rule, ruleFinding]) => ({
        rule,
        count: ruleFinding.length,
        impact: ruleFinding[0].impact,
        estimatedTime: this.calculateGroupFixTime(ruleFinding),
        scoreGain: this.calculatePotentialScoreGain(ruleFinding)
      }))
      .sort((a, b) => b.scoreGain - a.scoreGain)
      .slice(0, 5);
    
    return {
      totalQuickWins: quickWins.length,
      estimatedTime: this.calculateTotalFixTime(quickWins),
      potentialScoreGain: priorityFixes.reduce((sum, fix) => sum + fix.scoreGain, 0),
      priorityFixes
    };
  }
  
  static generateTopIssuesReport(findings: NormalizedFinding[]): TopIssuesReport {
    const grouped = this.groupByRule(findings);
    
    const issues = Object.entries(grouped)
      .map(([rule, ruleFindings]) => {
        const first = ruleFindings[0];
        return {
          rule,
          wcag: first.wcagCriterion,
          count: ruleFindings.length,
          impact: first.impact,
          legalRisk: first.legalRisk,
          description: first.description,
          businessJustification: this.generateBusinessJustification(first, ruleFindings.length)
        };
      })
      .sort((a, b) => {
        // Sort by legal risk, then by count
        const riskOrder = { high: 3, medium: 2, low: 1 };
        const riskDiff = riskOrder[b.legalRisk as keyof typeof riskOrder] - riskOrder[a.legalRisk as keyof typeof riskOrder];
        return riskDiff !== 0 ? riskDiff : b.count - a.count;
      })
      .slice(0, 10);
    
    return {
      issues,
      summary: {
        totalUniqueIssues: Object.keys(grouped).length,
        criticalCount: findings.filter(f => f.impact === 'critical').length,
        highLegalRisk: findings.filter(f => f.legalRisk === 'high').length,
        averageFixTime: this.calculateAverageFixTime(findings)
      }
    };
  }
  
  // Helper methods
  
  private static mapAxeImpact(impact: string | null): 'critical' | 'serious' | 'moderate' | 'minor' {
    switch (impact) {
      case 'critical': return 'critical';
      case 'serious': return 'serious';
      case 'moderate': return 'moderate';
      default: return 'minor';
    }
  }
  
  private static impactToNumeric(impact: string | null): number {
    switch (impact) {
      case 'critical': return 4;
      case 'serious': return 3;
      case 'moderate': return 2;
      default: return 1;
    }
  }
  
  private static extractElementType(html: string): string {
    const match = html.match(/<(\w+)/);
    return match ? match[1].toLowerCase() : 'unknown';
  }
  
  private static getDefaultMetadata(ruleId: string) {
    return {
      wcag: '4.1.2',
      level: 'A' as const,
      category: 'robust' as const,
      legalRisk: 'medium' as const,
      quickWin: false,
      businessImpact: 'General accessibility improvement needed',
      userImpact: 'May impact users with disabilities'
    };
  }
  
  private static estimateFixTime(ruleId: string, quickWin: boolean): string {
    const timeMap: Record<string, string> = {
      'image-alt': '2-5 minutes per image',
      'label': '1-3 minutes per form field',
      'link-name': '1-2 minutes per link',
      'button-name': '1-2 minutes per button',
      'color-contrast': '10-30 minutes per element',
      'keyboard': '30-60 minutes per interaction',
      'heading-order': '5-15 minutes per page'
    };
    
    return timeMap[ruleId] || (quickWin ? '5-10 minutes' : '15-30 minutes');
  }
  
  private static generateRemediation(ruleId: string, elementHtml: string) {
    const remediationMap: Record<string, { code: string; description: string; effort: 'low' | 'medium' | 'high' }> = {
      'image-alt': {
        code: `<img src="..." alt="Descriptive text about the image content" />`,
        description: 'Add meaningful alt text that describes the image purpose and content',
        effort: 'low'
      },
      'label': {
        code: `<label for="input-id">Field Label</label>\n<input id="input-id" type="text" />`,
        description: 'Associate every form input with a descriptive label',
        effort: 'low'
      },
      'color-contrast': {
        code: `/* Ensure sufficient color contrast */\n.element {\n  color: #1a1a1a; /* Dark text */\n  background: #ffffff; /* Light background */\n}`,
        description: 'Adjust colors to meet WCAG AA contrast ratio of 4.5:1',
        effort: 'medium'
      },
      'keyboard': {
        code: `<button tabindex="0" onKeyDown={handleKeyPress}>\n  Button Text\n</button>`,
        description: 'Ensure all interactive elements are keyboard accessible',
        effort: 'high'
      }
    };
    
    return remediationMap[ruleId] || {
      code: '// See WCAG guidance for specific remediation',
      description: 'Follow WCAG guidelines to fix this accessibility issue',
      effort: 'medium'
    };
  }
  
  private static calculateCategoryScore(findings: NormalizedFinding[], category: string): number {
    const categoryFindings = findings.filter(f => f.category === category);
    if (categoryFindings.length === 0) return 100;
    
    let penalty = 0;
    categoryFindings.forEach(f => {
      penalty += f.severity * (f.legalRisk === 'high' ? 2 : 1);
    });
    
    return Math.max(0, 100 - penalty);
  }
  
  private static groupByRule(findings: NormalizedFinding[]): Record<string, NormalizedFinding[]> {
    return findings.reduce((groups, finding) => {
      const rule = finding.ruleId;
      if (!groups[rule]) groups[rule] = [];
      groups[rule].push(finding);
      return groups;
    }, {} as Record<string, NormalizedFinding[]>);
  }
  
  private static calculateGroupFixTime(findings: NormalizedFinding[]): string {
    const baseTime = parseInt(findings[0].estimatedFixTime.split('-')[0]) || 5;
    const totalMinutes = baseTime * findings.length;
    
    if (totalMinutes < 60) return `${totalMinutes} minutes`;
    return `${Math.round(totalMinutes / 60 * 10) / 10} hours`;
  }
  
  private static calculatePotentialScoreGain(findings: NormalizedFinding[]): number {
    return findings.reduce((gain, f) => gain + (f.severity * 2), 0);
  }
  
  private static calculateTotalFixTime(findings: NormalizedFinding[]): string {
    const totalMinutes = findings.reduce((sum, f) => {
      const time = parseInt(f.estimatedFixTime.split('-')[0]) || 5;
      return sum + time;
    }, 0);
    
    if (totalMinutes < 60) return `${totalMinutes} minutes`;
    return `${Math.round(totalMinutes / 60 * 10) / 10} hours`;
  }
  
  private static generateBusinessJustification(finding: NormalizedFinding, count: number): string {
    const templates = {
      high: `Critical legal risk: ${count} instances could trigger ADA lawsuits. ${finding.businessImpact}`,
      medium: `Moderate impact: ${count} instances affecting user experience. ${finding.businessImpact}`,
      low: `Quality improvement: ${count} instances to enhance accessibility. ${finding.businessImpact}`
    };
    
    return templates[finding.legalRisk];
  }
  
  private static calculateAverageFixTime(findings: NormalizedFinding[]): string {
    const totalMinutes = findings.reduce((sum, f) => {
      const time = parseInt(f.estimatedFixTime.split('-')[0]) || 15;
      return sum + time;
    }, 0);
    
    const avgMinutes = totalMinutes / findings.length;
    return `${Math.round(avgMinutes)} minutes per issue`;
  }
}