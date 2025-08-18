export interface ScanConfig {
  url: string;
  depth: 'surface' | 'interactive' | 'exhaustive';
  includeSubpages?: boolean;
  maxPages?: number;
  wcagLevel: 'A' | 'AA' | 'AAA';
}

export interface PageElement {
  type: 'image' | 'button' | 'form' | 'link' | 'heading' | 'video' | 'audio' | 'table' | 'list' | 'text';
  html: string;
  selector: string;
  attributes: Record<string, string>;
  computedStyles: Partial<CSSStyleDeclaration>;
  text: string;
  ariaAttributes: Record<string, string>;
  parentContext: string;
  isInteractive: boolean;
  keyboardAccessible?: boolean;
  tabIndex?: number;
}

export interface Violation {
  rule: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  element: string;
  message: string;
  impact: string;
  legalRisk: 'high' | 'medium' | 'low';
  howToFix: string;
  codeExample: string;
  wcagCriterion?: string;
  lawsuitProbability?: number;
}

export interface PageScanResult {
  url: string;
  elements: PageElement[];
  violations: Violation[];
  complianceScore: number;
}

export interface ComplianceSummary {
  overallScore: number;
  wcagLevel: string;
  totalViolations: number;
  criticalViolations: number;
  majorViolations: number;
  minorViolations: number;
  lawsuitRisk: number;
}

export interface ScanResult {
  url: string;
  timestamp: string;
  pages: PageScanResult[];
  summary: ComplianceSummary;
  violations: Violation[];
  riskScore: number;
  elements: PageElement[];
}

export interface CompanyInfo {
  industry: string;
  estimatedRevenue: string;
  userBase: string;
  domain?: string;
  location?: string;
}

export interface LawsuitRiskAssessment {
  lawsuitProbability: number;
  estimatedSettlement: {
    min: number;
    max: number;
  };
  similarCase: {
    defendant: string;
    settlement: number;
    violations: string[];
  };
  serialPlaintiffScore: number;
  highRiskElements: string[];
  recommendedActions: {
    immediate: string[];
    urgent: string[];
    standard: string[];
  };
}

export interface AutoFix {
  originalCode: string;
  fixedCode: string;
  commitMessage: string;
  prDescription: string;
  testCases: string[];
  rollbackInstructions: string;
}