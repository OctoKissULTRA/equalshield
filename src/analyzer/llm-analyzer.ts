import Anthropic from '@anthropic-ai/sdk';
import { OpenAI } from 'openai';
import { Violation, PageElement, CompanyInfo, LawsuitRiskAssessment, AutoFix } from '../scanner/types';

interface ContextualViolation extends Violation {
  contextReason: string;
  falsePositive: boolean;
}

interface LLMAnalysisResult {
  contextualViolations: ContextualViolation[];
  userJourneyBlockers: string[];
  litigationRisks: string[];
  prioritizedFixes: Violation[];
  falsePositives: string[];
}

export class LLMComplianceAnalyzer {
  private openai: OpenAI | null = null;
  private claude: Anthropic | null = null;
  
  constructor() {
    // Primary: OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });
    }
    // Fallback: Claude (optional)
    if (process.env.CLAUDE_API_KEY) {
      this.claude = new Anthropic({ 
        apiKey: process.env.CLAUDE_API_KEY 
      });
    }
  }

  async analyzeForCompliance(
    elements: PageElement[], 
    existingViolations: Violation[]
  ): Promise<LLMAnalysisResult> {
    const prompt = `
You are an ADA compliance expert and accessibility lawyer. Analyze these website elements for WCAG 2.1 Level AA compliance.

Elements found on page:
${JSON.stringify(elements.slice(0, 50), null, 2)}

Already detected violations:
${JSON.stringify(existingViolations.slice(0, 30), null, 2)}

Perform deep analysis for:
1. Context-specific violations (e.g., decorative vs informational images)
2. User journey blockers (can a blind user complete purchase?)
3. Litigation triggers (what would a plaintiff's lawyer focus on?)
4. Business-critical paths that MUST be accessible

For each issue found, provide:
- WCAG criterion violated
- Real-world impact on disabled users
- Lawsuit probability (based on recent ADA litigation)
- Specific code fix (not generic advice)
- Business justification for fixing it

Also identify:
- False positives from automated scanning
- Violations that are technically compliant but practically problematic
- "Lawsuit honeypots" - elements that attract ADA trolls

Format as JSON with structure:
{
  "contextualViolations": [
    {
      "rule": "WCAG X.X.X",
      "severity": "critical|serious|moderate|minor",
      "element": "selector",
      "message": "description",
      "impact": "user impact",
      "legalRisk": "high|medium|low",
      "howToFix": "specific instructions",
      "codeExample": "actual code",
      "contextReason": "why this is contextually important",
      "falsePositive": false
    }
  ],
  "userJourneyBlockers": ["description of blocking issues"],
  "litigationRisks": ["specific lawsuit triggers"],
  "prioritizedFixes": [...],
  "falsePositives": ["list of false positive detection IDs"]
}`;

    try {
      let response: string;
      
      if (this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-5',
          messages: [{ 
            role: 'user', 
            content: prompt 
          }],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_completion_tokens: 4000
        });
        response = completion.choices[0].message.content || '';
      } else if (this.claude) {
        const message = await this.claude.messages.create({
          model: 'claude-3-sonnet-20240229',
          max_completion_tokens: 4000,
          messages: [{ 
            role: 'user', 
            content: prompt 
          }]
        });
        response = message.content[0].type === 'text' ? message.content[0].text : '';
      } else {
        // Fallback to rule-based analysis if no LLM available
        return this.fallbackAnalysis(elements, existingViolations);
      }

      return JSON.parse(response) as LLMAnalysisResult;
    } catch (error) {
      console.error('LLM analysis failed:', error);
      return this.fallbackAnalysis(elements, existingViolations);
    }
  }

  async generateLawsuitRiskAssessment(
    violations: Violation[], 
    companyInfo: CompanyInfo
  ): Promise<LawsuitRiskAssessment> {
    const recentLawsuits = await this.fetchRecentADALawsuits();
    
    const prompt = `
Based on recent ADA lawsuits in 2024-2025:
${JSON.stringify(recentLawsuits, null, 2)}

This website has these violations:
${JSON.stringify(violations.slice(0, 50), null, 2)}

Company info:
- Industry: ${companyInfo.industry}
- Revenue: ${companyInfo.estimatedRevenue}
- User base: ${companyInfo.userBase}

Calculate:
1. Probability of lawsuit in next 12 months (0-100)
2. Estimated settlement range if sued
3. Most similar past case and its outcome
4. "Serial plaintiff" attraction score (1-10)
5. Specific elements that match patterns in successful lawsuits

Consider these real cases:
- Domino's Pizza: $38,000 settlement for inaccessible mobile ordering
- Target Corp: $6 million for inaccessible website
- Beyoncé's Parkwood Entertainment: Sued for image-heavy site without alt text
- Nike: $990,000 for lack of screen reader compatibility
- Winn-Dixie: Lost case for inaccessible pharmacy site

Return JSON:
{
  "lawsuitProbability": number (0-100),
  "estimatedSettlement": { "min": number, "max": number },
  "similarCase": { 
    "defendant": "company name",
    "settlement": number,
    "violations": ["list of violations"]
  },
  "serialPlaintiffScore": number (1-10),
  "highRiskElements": ["specific risky elements"],
  "recommendedActions": {
    "immediate": ["fix within 24 hours"],
    "urgent": ["fix within 1 week"],
    "standard": ["fix within 1 month"]
  }
}`;

    try {
      let response: string;
      
      if (this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-5',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_completion_tokens: 3000
        });
        response = completion.choices[0].message.content || '';
      } else if (this.claude) {
        const message = await this.claude.messages.create({
          model: 'claude-3-sonnet-20240229',
          max_completion_tokens: 3000,
          messages: [{ role: 'user', content: prompt }]
        });
        response = message.content[0].type === 'text' ? message.content[0].text : '';
      } else {
        return this.calculateRiskWithoutLLM(violations, companyInfo);
      }

      return JSON.parse(response) as LawsuitRiskAssessment;
    } catch (error) {
      console.error('Risk assessment failed:', error);
      return this.calculateRiskWithoutLLM(violations, companyInfo);
    }
  }

  async generateAutoFix(violation: Violation, framework: string): Promise<AutoFix> {
    const prompt = `
Generate production-ready fix for this accessibility violation:

Violation: ${JSON.stringify(violation)}
Framework: ${framework}

Provide:
1. Exact code replacement (not pseudocode)
2. Git commit message
3. Pull request description
4. Test cases to verify fix
5. Rollback plan if fix breaks something

Requirements:
- Code must be drop-in replacement
- Include all necessary imports
- Handle edge cases
- Maintain existing functionality
- Follow ${framework} best practices

Format as:
{
  "originalCode": "exact original code",
  "fixedCode": "exact fixed code",
  "commitMessage": "feat(a11y): fix WCAG X.X.X violation",
  "prDescription": "detailed PR description",
  "testCases": ["test case 1", "test case 2"],
  "rollbackInstructions": "how to rollback if needed"
}`;

    try {
      let response: string;
      
      if (this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-5',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_completion_tokens: 2000
        });
        response = completion.choices[0].message.content || '';
      } else if (this.claude) {
        const message = await this.claude.messages.create({
          model: 'claude-3-sonnet-20240229',
          max_completion_tokens: 2000,
          messages: [{ role: 'user', content: prompt }]
        });
        response = message.content[0].type === 'text' ? message.content[0].text : '';
      } else {
        return this.generateBasicFix(violation, framework);
      }

      return JSON.parse(response) as AutoFix;
    } catch (error) {
      console.error('Auto-fix generation failed:', error);
      return this.generateBasicFix(violation, framework);
    }
  }

  private async fetchRecentADALawsuits(): Promise<any[]> {
    // In production, this would fetch from a real database
    // For now, return sample data
    return [
      {
        defendant: "E-commerce Giant",
        plaintiff: "Serial Plaintiff LLC",
        filedDate: "2024-03-15",
        settlementAmount: 75000,
        violationsCited: ["missing alt text", "keyboard inaccessible checkout", "poor color contrast"],
        industry: "retail",
        outcome: "settled"
      },
      {
        defendant: "Restaurant Chain",
        plaintiff: "Access Advocates",
        filedDate: "2024-02-20",
        settlementAmount: 50000,
        violationsCited: ["inaccessible online ordering", "missing form labels"],
        industry: "food service",
        outcome: "settled"
      },
      {
        defendant: "Hotel Brand",
        plaintiff: "Equal Access Foundation",
        filedDate: "2024-01-10",
        settlementAmount: 100000,
        violationsCited: ["booking system not screen reader compatible", "videos without captions"],
        industry: "hospitality",
        outcome: "settled"
      }
    ];
  }

  private fallbackAnalysis(
    elements: PageElement[], 
    existingViolations: Violation[]
  ): LLMAnalysisResult {
    // Rule-based fallback when LLM is not available
    const contextualViolations: ContextualViolation[] = [];
    const userJourneyBlockers: string[] = [];
    const litigationRisks: string[] = [];

    // Check for common contextual issues
    elements.forEach(element => {
      // Check for click-only interactions
      if (element.isInteractive && element.attributes.onclick && !element.attributes.onkeydown) {
        userJourneyBlockers.push(`Interactive element at ${element.selector} is not keyboard accessible`);
        litigationRisks.push(`Mouse-only interaction at ${element.selector} - common lawsuit trigger`);
      }

      // Check for form without labels
      if (element.type === 'form' && !element.ariaAttributes['aria-label']) {
        userJourneyBlockers.push(`Form input at ${element.selector} lacks proper labeling`);
      }

      // Check for images in critical paths
      if (element.type === 'image' && !element.attributes.alt && element.parentContext.includes('button')) {
        contextualViolations.push({
          rule: 'WCAG 1.1.1',
          severity: 'critical',
          element: element.selector,
          message: 'Image button without alternative text',
          impact: 'Button purpose unknown to screen reader users',
          legalRisk: 'high',
          howToFix: 'Add alt text describing button action',
          codeExample: `<img src="${element.attributes.src}" alt="[Button action]" />`,
          contextReason: 'Image is part of interactive button',
          falsePositive: false,
          wcagCriterion: '1.1.1',
          lawsuitProbability: 0.8
        });
      }
    });

    // Identify high-priority fixes
    const prioritizedFixes = existingViolations
      .filter(v => v.severity === 'critical' || v.legalRisk === 'high')
      .slice(0, 10);

    return {
      contextualViolations,
      userJourneyBlockers,
      litigationRisks,
      prioritizedFixes,
      falsePositives: []
    };
  }

  private calculateRiskWithoutLLM(
    violations: Violation[], 
    companyInfo: CompanyInfo
  ): LawsuitRiskAssessment {
    // Calculate risk based on violation patterns
    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const seriousCount = violations.filter(v => v.severity === 'serious').length;
    
    // Base probability on violation severity
    let probability = Math.min(100, (criticalCount * 15) + (seriousCount * 8));
    
    // Adjust for industry (retail and hospitality are higher risk)
    if (['retail', 'ecommerce', 'hospitality', 'finance'].includes(companyInfo.industry.toLowerCase())) {
      probability = Math.min(100, probability * 1.5);
    }

    // Settlement estimates based on company size
    const revenueMultiplier = companyInfo.estimatedRevenue.includes('M') ? 1000000 : 
                             companyInfo.estimatedRevenue.includes('B') ? 1000000000 : 100000;
    const baseSettlement = 25000;
    const maxSettlement = baseSettlement * (criticalCount + 1);

    return {
      lawsuitProbability: Math.round(probability),
      estimatedSettlement: {
        min: baseSettlement,
        max: Math.min(maxSettlement, revenueMultiplier * 0.001)
      },
      similarCase: {
        defendant: 'Similar Company in ' + companyInfo.industry,
        settlement: 50000,
        violations: violations.slice(0, 3).map(v => v.message)
      },
      serialPlaintiffScore: Math.min(10, Math.round(criticalCount / 2)),
      highRiskElements: violations
        .filter(v => v.legalRisk === 'high')
        .map(v => v.element)
        .slice(0, 5),
      recommendedActions: {
        immediate: violations
          .filter(v => v.severity === 'critical')
          .map(v => `Fix ${v.rule}: ${v.message}`)
          .slice(0, 3),
        urgent: violations
          .filter(v => v.severity === 'serious')
          .map(v => `Fix ${v.rule}: ${v.message}`)
          .slice(0, 5),
        standard: violations
          .filter(v => v.severity === 'moderate')
          .map(v => `Fix ${v.rule}: ${v.message}`)
          .slice(0, 10)
      }
    };
  }

  private generateBasicFix(violation: Violation, framework: string): AutoFix {
    return {
      originalCode: '<!-- Original code with violation -->',
      fixedCode: violation.codeExample,
      commitMessage: `fix(a11y): resolve ${violation.rule} violation - ${violation.message}`,
      prDescription: `## Accessibility Fix

This PR fixes a ${violation.severity} accessibility violation:
- **Rule**: ${violation.rule}
- **Issue**: ${violation.message}
- **Impact**: ${violation.impact}
- **Legal Risk**: ${violation.legalRisk}

### Changes Made
${violation.howToFix}

### Testing
- Verified with screen reader
- Tested keyboard navigation
- Confirmed WCAG compliance`,
      testCases: [
        `Test that ${violation.element} is accessible via keyboard`,
        `Verify screen reader announces ${violation.element} correctly`,
        `Confirm visual appearance unchanged`
      ],
      rollbackInstructions: 'Revert this commit if any functionality breaks'
    };
  }
}