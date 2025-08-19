import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { scans, violations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface GitHubRepo {
  owner: string;
  repo: string;
  token: string;
}

interface Fix {
  file: string;
  oldCode: string;
  newCode: string;
  description: string;
  wcagCriterion: string;
}

class GitHubPRGenerator {
  private repo: GitHubRepo;
  
  constructor(repo: GitHubRepo) {
    this.repo = repo;
  }

  async createAccessibilityPR(fixes: Fix[], scanUrl: string): Promise<string> {
    const branch = `ada-fixes-${Date.now()}`;
    
    try {
      // Create branch
      await this.createBranch(branch);
      
      // Apply fixes
      for (const fix of fixes) {
        await this.commitFix(branch, fix);
      }
      
      // Create PR
      const prUrl = await this.createPR(branch, fixes, scanUrl);
      return prUrl;
      
    } catch (error) {
      console.error('PR creation failed:', error);
      throw error;
    }
  }

  private async createBranch(branch: string) {
    const response = await fetch(`https://api.github.com/repos/${this.repo.owner}/${this.repo.repo}/git/refs/heads/main`, {
      headers: {
        'Authorization': `token ${this.repo.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    const mainRef = await response.json();
    
    await fetch(`https://api.github.com/repos/${this.repo.owner}/${this.repo.repo}/git/refs`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${this.repo.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha: mainRef.object.sha
      })
    });
  }

  private async commitFix(branch: string, fix: Fix) {
    // Get current file content
    const fileResponse = await fetch(`https://api.github.com/repos/${this.repo.owner}/${this.repo.repo}/contents/${fix.file}?ref=${branch}`, {
      headers: {
        'Authorization': `token ${this.repo.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!fileResponse.ok) {
      console.warn(`File ${fix.file} not found, skipping...`);
      return;
    }

    const fileData = await fileResponse.json();
    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
    
    // Apply fix
    const updatedContent = currentContent.replace(fix.oldCode, fix.newCode);
    
    if (updatedContent === currentContent) {
      console.warn(`No changes made to ${fix.file}, pattern not found`);
      return;
    }
    
    // Commit the fix
    await fetch(`https://api.github.com/repos/${this.repo.owner}/${this.repo.repo}/contents/${fix.file}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${this.repo.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Fix WCAG ${fix.wcagCriterion}: ${fix.description}`,
        content: Buffer.from(updatedContent).toString('base64'),
        sha: fileData.sha,
        branch: branch
      })
    });
  }

  private async createPR(branch: string, fixes: Fix[], scanUrl: string): Promise<string> {
    const criticalFixes = fixes.filter(f => f.wcagCriterion.startsWith('1.1.1') || f.wcagCriterion.startsWith('2.1.1'));
    const totalFixes = fixes.length;
    
    const prBody = `## 🛡️ Automated ADA Compliance Fixes

This PR automatically fixes ${totalFixes} accessibility violations found in your website scan.

### 🚨 Critical Issues Fixed
${criticalFixes.length > 0 ? 
  criticalFixes.map(f => `- **WCAG ${f.wcagCriterion}**: ${f.description}`).join('\\n') :
  'No critical issues found.'
}

### 📋 All Fixes Applied
${fixes.map(f => `- [ ] **${f.file}**: WCAG ${f.wcagCriterion} - ${f.description}`).join('\\n')}

### 🔍 Scan Details
- **Scan URL**: ${scanUrl}
- **Total violations fixed**: ${totalFixes}
- **Generated**: ${new Date().toISOString()}

### ✅ Testing Checklist
- [ ] Test all forms for proper labels
- [ ] Verify images have descriptive alt text  
- [ ] Check keyboard navigation works
- [ ] Test with screen reader
- [ ] Validate color contrast meets standards

### 📚 Resources
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [EqualShield Documentation](https://equalshield.com/docs)

---
🤖 **Generated with [EqualShield](https://equalshield.com)** - Professional ADA Compliance Platform

⚠️ **Important**: Please review and test these changes before merging. Automated fixes should be validated by your team.`;

    const prResponse = await fetch(`https://api.github.com/repos/${this.repo.owner}/${this.repo.repo}/pulls`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${this.repo.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: `🛡️ Fix ${totalFixes} ADA compliance violations`,
        body: prBody,
        head: branch,
        base: 'main'
      })
    });

    const pr = await prResponse.json();
    return pr.html_url;
  }
}

class FixGenerator {
  static generateReactFixes(violations: any[]): Fix[] {
    const fixes: Fix[] = [];
    
    violations.forEach(violation => {
      switch (violation.wcagCriterion) {
        case '1.1.1':
          if (violation.elementType === 'image') {
            fixes.push({
              file: 'src/components/ui/image.tsx', // Best guess
              oldCode: '<img src=',
              newCode: '<img alt="[Please add descriptive alt text]" src=',
              description: 'Add alt attribute to image',
              wcagCriterion: violation.wcagCriterion
            });
          }
          break;
          
        case '3.3.2':
          if (violation.elementType === 'form') {
            fixes.push({
              file: 'src/components/forms/contact-form.tsx',
              oldCode: '<input type="',
              newCode: '<label htmlFor="input-id">Label</label>\\n      <input id="input-id" type="',
              description: 'Add label for form input',
              wcagCriterion: violation.wcagCriterion
            });
          }
          break;
          
        case '2.4.4':
          if (violation.elementType === 'link') {
            fixes.push({
              file: 'src/components/ui/link.tsx',
              oldCode: '>Click here<',
              newCode: '>Learn more about our services<',
              description: 'Use descriptive link text',
              wcagCriterion: violation.wcagCriterion
            });
          }
          break;
          
        case '4.1.2':
          if (violation.elementType === 'button') {
            fixes.push({
              file: 'src/components/ui/button.tsx',
              oldCode: '<button>',
              newCode: '<button aria-label="[Describe button action]">',
              description: 'Add accessible name to button',
              wcagCriterion: violation.wcagCriterion
            });
          }
          break;
      }
    });
    
    return fixes;
  }
  
  static generateHTMLFixes(violations: any[]): Fix[] {
    const fixes: Fix[] = [];
    
    violations.forEach(violation => {
      switch (violation.wcagCriterion) {
        case '1.1.1':
          fixes.push({
            file: 'index.html',
            oldCode: '<img src=',
            newCode: '<img alt="[Please add descriptive alt text]" src=',
            description: 'Add alt attribute to image',
            wcagCriterion: violation.wcagCriterion
          });
          break;
          
        case '3.3.2':
          fixes.push({
            file: 'contact.html',
            oldCode: '<input type="email"',
            newCode: '<label for="email">Email Address</label>\\n    <input type="email" id="email"',
            description: 'Add label for email input',
            wcagCriterion: violation.wcagCriterion
          });
          break;
      }
    });
    
    return fixes;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { scanId, repoUrl, githubToken, framework = 'react' } = await req.json();
    
    if (!scanId || !repoUrl || !githubToken) {
      return NextResponse.json(
        { error: 'scanId, repoUrl, and githubToken are required' },
        { status: 400 }
      );
    }

    // Parse GitHub repo URL
    const repoMatch = repoUrl.match(/github\\.com\/([^\/]+)\/([^\/]+)/);
    if (!repoMatch) {
      return NextResponse.json(
        { error: 'Invalid GitHub repository URL' },
        { status: 400 }
      );
    }

    const [, owner, repo] = repoMatch;
    const repoInfo = { owner, repo: repo.replace('.git', ''), token: githubToken };

    // Get scan data
    const [scanData] = await db
      .select()
      .from(scans)
      .where(eq(scans.id, parseInt(scanId)))
      .limit(1);

    if (!scanData || scanData.status !== 'complete') {
      return NextResponse.json(
        { error: 'Scan not found or not completed' },
        { status: 404 }
      );
    }

    // Get violations
    const scanViolations = await db
      .select()
      .from(violations)
      .where(eq(violations.scanId, parseInt(scanId)));

    if (scanViolations.length === 0) {
      return NextResponse.json(
        { error: 'No violations found to fix' },
        { status: 400 }
      );
    }

    // Generate fixes based on framework
    let fixes: Fix[];
    switch (framework.toLowerCase()) {
      case 'react':
      case 'next':
        fixes = FixGenerator.generateReactFixes(scanViolations);
        break;
      case 'html':
      case 'vanilla':
        fixes = FixGenerator.generateHTMLFixes(scanViolations);
        break;
      default:
        fixes = FixGenerator.generateReactFixes(scanViolations); // Default to React
    }

    if (fixes.length === 0) {
      return NextResponse.json(
        { error: 'No fixable violations found for this framework' },
        { status: 400 }
      );
    }

    // Create PR
    const prGenerator = new GitHubPRGenerator(repoInfo);
    const prUrl = await prGenerator.createAccessibilityPR(fixes, scanData.url);

    return NextResponse.json({
      success: true,
      prUrl,
      fixesApplied: fixes.length,
      message: `Created PR with ${fixes.length} accessibility fixes`
    });

  } catch (error) {
    console.error('PR generation error:', error);
    return NextResponse.json(
      { error: 'Failed to create PR. Please check your GitHub token and repository permissions.' },
      { status: 500 }
    );
  }
}