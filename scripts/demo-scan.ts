#!/usr/bin/env npx tsx

import { ComplianceScanner } from '../src/scanner/engine';
import { LLMComplianceAnalyzer } from '../src/analyzer/llm-analyzer';
import * as path from 'path';
import * as fs from 'fs';

async function runDemo() {
  console.log('🔍 ADA Compliance Scanner Demo\n');
  
  const scanner = new ComplianceScanner();
  const analyzer = new LLMComplianceAnalyzer();
  
  // Test with the local violation test page
  const testFilePath = path.join(process.cwd(), 'tests', 'test-sites', 'accessibility-violations.html');
  
  if (!fs.existsSync(testFilePath)) {
    console.error('❌ Test file not found:', testFilePath);
    process.exit(1);
  }
  
  const fileUrl = `file://${testFilePath}`;
  
  console.log(`📄 Scanning: ${fileUrl}\n`);
  console.log('⏳ This may take 30-60 seconds...\n');
  
  try {
    const startTime = Date.now();
    
    // Run the scan
    const result = await scanner.scanWebsite({
      url: fileUrl,
      depth: 'exhaustive',
      wcagLevel: 'AA'
    });
    
    const scanTime = Date.now() - startTime;
    
    console.log('📊 SCAN RESULTS');
    console.log('================');
    console.log(`⏱️  Scan time: ${scanTime}ms`);
    console.log(`🔍 Elements analyzed: ${result.elements.length}`);
    console.log(`⚠️  Violations found: ${result.violations.length}`);
    console.log(`🎯 Risk score: ${result.riskScore}/100\n`);
    
    // Group violations by severity
    const severityGroups = {
      critical: result.violations.filter(v => v.severity === 'critical'),
      serious: result.violations.filter(v => v.severity === 'serious'),
      moderate: result.violations.filter(v => v.severity === 'moderate'),
      minor: result.violations.filter(v => v.severity === 'minor')
    };
    
    console.log('📋 VIOLATION BREAKDOWN');
    console.log('======================');
    console.log(`🚨 Critical: ${severityGroups.critical.length}`);
    console.log(`⚠️  Serious: ${severityGroups.serious.length}`);
    console.log(`📝 Moderate: ${severityGroups.moderate.length}`);
    console.log(`ℹ️  Minor: ${severityGroups.minor.length}\n`);
    
    // Show top 5 critical violations
    if (severityGroups.critical.length > 0) {
      console.log('🚨 TOP CRITICAL VIOLATIONS');
      console.log('===========================');
      severityGroups.critical.slice(0, 5).forEach((violation, index) => {
        console.log(`${index + 1}. ${violation.rule}: ${violation.message}`);
        console.log(`   Element: ${violation.element}`);
        console.log(`   Legal Risk: ${violation.legalRisk}`);
        console.log(`   Fix: ${violation.howToFix}\n`);
      });
    }
    
    // Run LLM analysis if API keys are available
    if (process.env.CLAUDE_API_KEY || process.env.OPENAI_API_KEY) {
      console.log('🤖 RUNNING AI ANALYSIS');
      console.log('======================');
      console.log('⏳ Analyzing context and calculating lawsuit risk...\n');
      
      try {
        const llmAnalysis = await analyzer.analyzeForCompliance(
          result.elements,
          result.violations
        );
        
        console.log(`🎯 Contextual violations: ${llmAnalysis.contextualViolations.length}`);
        console.log(`🚫 User journey blockers: ${llmAnalysis.userJourneyBlockers.length}`);
        console.log(`⚖️  Litigation risks: ${llmAnalysis.litigationRisks.length}\n`);
        
        // Calculate lawsuit risk
        const riskAssessment = await analyzer.generateLawsuitRiskAssessment(
          [...result.violations, ...llmAnalysis.contextualViolations],
          {
            industry: 'Technology',
            estimatedRevenue: '$10M-50M',
            userBase: '100K+ users'
          }
        );
        
        console.log('⚖️  LAWSUIT RISK ASSESSMENT');
        console.log('============================');
        console.log(`📊 Lawsuit probability: ${riskAssessment.lawsuitProbability}%`);
        console.log(`💰 Settlement range: $${riskAssessment.estimatedSettlement.min.toLocaleString()} - $${riskAssessment.estimatedSettlement.max.toLocaleString()}`);
        console.log(`🎯 Serial plaintiff score: ${riskAssessment.serialPlaintiffScore}/10`);
        
        if (riskAssessment.similarCase) {
          console.log(`📝 Similar case: ${riskAssessment.similarCase.defendant} - $${riskAssessment.similarCase.settlement.toLocaleString()}`);
        }
        
        console.log('\n🔧 RECOMMENDED ACTIONS');
        console.log('=======================');
        
        if (riskAssessment.recommendedActions.immediate.length > 0) {
          console.log('🚨 IMMEDIATE (Fix within 24 hours):');
          riskAssessment.recommendedActions.immediate.forEach(action => {
            console.log(`   • ${action}`);
          });
          console.log();
        }
        
        if (riskAssessment.recommendedActions.urgent.length > 0) {
          console.log('⚠️  URGENT (Fix within 1 week):');
          riskAssessment.recommendedActions.urgent.slice(0, 3).forEach(action => {
            console.log(`   • ${action}`);
          });
          console.log();
        }
        
      } catch (llmError) {
        console.log('⚠️  LLM analysis failed:', llmError.message);
        console.log('   (This is expected without valid API keys)\n');
      }
    } else {
      console.log('💡 TIP: Add CLAUDE_API_KEY or OPENAI_API_KEY to .env for AI analysis\n');
    }
    
    // Show sample fixes
    console.log('🔧 SAMPLE FIXES');
    console.log('===============');
    
    const topViolations = result.violations
      .filter(v => v.severity === 'critical' || v.severity === 'serious')
      .slice(0, 3);
      
    topViolations.forEach((violation, index) => {
      console.log(`${index + 1}. ${violation.rule}: ${violation.message}`);
      console.log(`   Fix: ${violation.howToFix}`);
      console.log(`   Code: ${violation.codeExample.split('\n')[0]}...`);
      console.log();
    });
    
    // Summary and recommendations
    console.log('📈 SUMMARY & NEXT STEPS');
    console.log('========================');
    
    if (result.riskScore >= 70) {
      console.log('🚨 HIGH RISK: Immediate action required');
      console.log('   • Fix critical violations within 24 hours');
      console.log('   • Consider professional accessibility audit');
      console.log('   • Document all remediation efforts');
    } else if (result.riskScore >= 40) {
      console.log('⚠️  MEDIUM RISK: Address within 30 days');
      console.log('   • Prioritize user journey blocking issues');
      console.log('   • Implement automated accessibility testing');
    } else {
      console.log('✅ LOW RISK: Monitor and maintain');
      console.log('   • Continue regular scanning');
      console.log('   • Address violations during normal development');
    }
    
    console.log('\n💡 REMEMBER:');
    console.log('• This tool provides automated analysis only');
    console.log('• Consult accessibility experts for complex issues');
    console.log('• Document all remediation efforts for legal protection');
    console.log('• Test fixes with real users when possible\n');
    
    console.log('🎉 Demo completed successfully!');
    
    // Save results to file
    const reportPath = path.join(process.cwd(), 'scan-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      url: fileUrl,
      scanTime,
      summary: {
        elementsAnalyzed: result.elements.length,
        violationsFound: result.violations.length,
        riskScore: result.riskScore,
        severityBreakdown: {
          critical: severityGroups.critical.length,
          serious: severityGroups.serious.length,
          moderate: severityGroups.moderate.length,
          minor: severityGroups.minor.length
        }
      },
      violations: result.violations,
      elements: result.elements.slice(0, 10) // Truncate for file size
    }, null, 2));
    
    console.log(`📄 Full report saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Scan failed:', error.message);
    
    if (error.message.includes('browser')) {
      console.log('\n💡 TIP: Install Playwright browsers with:');
      console.log('   npm run scanner:install');
    }
    
    process.exit(1);
  }
}

// Run the demo
if (require.main === module) {
  runDemo().catch(console.error);
}