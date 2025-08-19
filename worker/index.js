// worker/index.js
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import OpenAI from 'openai';

// Initialize services
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Health check server for Railway
import { createServer } from 'http';
const PORT = process.env.PORT || 3000;
const WORKER_ID = process.env.RAILWAY_REPLICA_ID || `worker-${Date.now()}`;

createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'healthy', worker: WORKER_ID }));
  }
}).listen(PORT, () => {
  console.log(`🏥 Health check on port ${PORT}`);
});

// Helper functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Canonical Page Extractor
class CanonicalExtractor {
  static async extract(page) {
    const canonical = await page.evaluate(() => {
      // Helper to get unique selector
      const getSelector = (el) => {
        if (el.id) return `#${el.id}`;
        if (el.className) return `.${el.className.split(' ')[0]}`;
        return el.tagName.toLowerCase();
      };

      // Extract layout structure
      const layout = {
        landmarks: Array.from(document.querySelectorAll('[role]')).map(el => ({
          role: el.getAttribute('role'),
          selector: getSelector(el)
        })),
        headingTree: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({
          level: parseInt(h.tagName[1]),
          text: h.textContent.trim(),
          selector: getSelector(h)
        })),
        linkGraph: Array.from(document.querySelectorAll('a[href]')).map(a => ({
          text: a.textContent.trim(),
          href: a.href,
          internal: a.hostname === window.location.hostname
        }))
      };

      // Extract accessibility tree
      const a11y = {
        roles: Array.from(document.querySelectorAll('[role]')).map(el => ({
          selector: getSelector(el),
          role: el.getAttribute('role'),
          name: el.getAttribute('aria-label') || el.textContent.trim()
        })),
        focusOrder: Array.from(document.querySelectorAll('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])')).map(el => ({
          selector: getSelector(el),
          type: el.tagName.toLowerCase(),
          tabindex: el.tabIndex
        })),
        colorPairs: [] // Simplified for MVP
      };

      // Extract content
      const content = {
        visibleText: document.body.innerText,
        tables: Array.from(document.querySelectorAll('table')).map(table => ({
          headers: Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim()),
          rows: Array.from(table.querySelectorAll('tbody tr')).length
        })),
        imageContexts: Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.src,
          alt: img.alt,
          ariaLabel: img.getAttribute('aria-label'),
          decorative: img.getAttribute('role') === 'presentation' || img.alt === '',
          surroundingText: img.parentElement?.textContent.trim()
        }))
      };

      // Extract forms and flows
      const flows = {
        forms: Array.from(document.querySelectorAll('form')).map(form => ({
          action: form.action,
          method: form.method,
          inputs: Array.from(form.querySelectorAll('input,select,textarea')).map(input => ({
            type: input.type || input.tagName.toLowerCase(),
            name: input.name,
            label: document.querySelector(`label[for="${input.id}"]`)?.textContent.trim()
          }))
        })),
        ctaButtons: Array.from(document.querySelectorAll('button,a.button,[role="button"]')).map(btn => ({
          text: btn.textContent.trim(),
          selector: getSelector(btn)
        }))
      };

      // Detect meta information
      const meta = {
        framework: window.React ? 'react' : window.Vue ? 'vue' : window.Next ? 'next' : 'vanilla',
        language: document.documentElement.lang || 'en',
        canonical: document.querySelector('link[rel="canonical"]')?.href || window.location.href
      };

      return { layout, a11y, content, flows, meta };
    });

    return {
      url: page.url(),
      timestamp: new Date().toISOString(),
      ...canonical
    };
  }
}

// Rule Engine for deterministic checks
class RuleEngine {
  static analyze(canonicalPage) {
    const findings = [];

    // WCAG 1.1.1 - Images need alt text
    canonicalPage.content.imageContexts.forEach((img, idx) => {
      if (!img.decorative && !img.alt && !img.ariaLabel) {
        findings.push({
          wcagCriterion: '1.1.1',
          severity: 'critical',
          elementType: 'image',
          elementSelector: `img:nth-of-type(${idx + 1})`,
          elementHtml: `<img src="${img.src}">`,
          pageUrl: canonicalPage.url,
          userImpact: 'Screen readers cannot describe this image',
          businessImpact: 'Users with visual impairments cannot access image content',
          legalRiskLevel: 'high',
          fixDescription: 'Add descriptive alt text to the image',
          fixCode: `<img alt="[Describe the image content]" src="${img.src}">`,
          fixEffort: 'trivial',
          estimatedFixTime: '2 minutes',
          aiConfidence: 1.0
        });
      }
    });

    // WCAG 3.3.2 - Form inputs need labels
    canonicalPage.flows.forms.forEach(form => {
      form.inputs.forEach(input => {
        if (!input.label && input.type !== 'hidden' && input.type !== 'submit') {
          findings.push({
            wcagCriterion: '3.3.2',
            severity: 'serious',
            elementType: 'form',
            elementSelector: input.name ? `[name="${input.name}"]` : 'input',
            userImpact: 'Users cannot determine the purpose of this input field',
            businessImpact: 'Form completion rates will be lower',
            legalRiskLevel: 'high',
            fixDescription: 'Add a label for this input field',
            fixCode: `<label for="${input.name}">[Label text]</label>`,
            fixEffort: 'easy',
            estimatedFixTime: '5 minutes',
            aiConfidence: 0.95
          });
        }
      });
    });

    // WCAG 2.4.4 - Links need descriptive text
    canonicalPage.layout.linkGraph.forEach(link => {
      if (!link.text || link.text === 'click here' || link.text === 'read more') {
        findings.push({
          wcagCriterion: '2.4.4',
          severity: 'moderate',
          elementType: 'link',
          userImpact: 'Link purpose is unclear',
          legalRiskLevel: 'medium',
          fixDescription: 'Use descriptive link text',
          fixEffort: 'easy',
          estimatedFixTime: '3 minutes',
          aiConfidence: 0.9
        });
      }
    });

    // WCAG 1.3.1 - Heading hierarchy
    let lastLevel = 0;
    canonicalPage.layout.headingTree.forEach((heading, idx) => {
      if (idx === 0 && heading.level !== 1) {
        findings.push({
          wcagCriterion: '1.3.1',
          severity: 'moderate',
          elementType: 'heading',
          userImpact: 'Document structure is confusing for screen readers',
          legalRiskLevel: 'low',
          fixDescription: 'Start page with H1',
          fixEffort: 'easy',
          estimatedFixTime: '5 minutes',
          aiConfidence: 0.85
        });
      }
      if (heading.level - lastLevel > 1) {
        findings.push({
          wcagCriterion: '1.3.1',
          severity: 'minor',
          elementType: 'heading',
          userImpact: `Heading jumps from H${lastLevel} to H${heading.level}`,
          legalRiskLevel: 'low',
          fixDescription: 'Fix heading hierarchy',
          fixEffort: 'easy',
          estimatedFixTime: '5 minutes',
          aiConfidence: 0.8
        });
      }
      lastLevel = heading.level;
    });

    return findings;
  }
}

// GPT-5 Analyzer for contextual intelligence
class GPT5Analyzer {
  static async analyze(canonicalPage, ruleFindings) {
    try {
      const prompt = `You are an ADA compliance expert analyzing a website for accessibility violations.

Page Structure:
${JSON.stringify(canonicalPage, null, 2).substring(0, 3000)}

Already detected ${ruleFindings.length} violations.

Find additional contextual issues:
1. Decorative vs informative image detection
2. User journey blockers
3. Confusing UX patterns that impact accessibility
4. Patterns from recent ADA lawsuits (Target, Domino's, etc.)

Return ONLY valid JSON array of findings:
[{
  "wcagCriterion": "WCAG criterion number",
  "severity": "critical|serious|moderate|minor",
  "elementSelector": "CSS selector",
  "userImpact": "How this affects users",
  "legalRiskLevel": "high|medium|low",
  "fixDescription": "How to fix",
  "fixCode": "Example code",
  "fixEffort": "trivial|easy|moderate|complex",
  "estimatedFixTime": "X minutes",
  "aiConfidence": 0.0-1.0
}]`;

      const completion = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an expert accessibility auditor. Return only valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_completion_tokens: 1000,
        temperature: 0.3
      });

      const response = completion.choices[0]?.message?.content || '[]';
      return JSON.parse(response);
    } catch (error) {
      console.error('GPT-5 analysis failed:', error);
      return [];
    }
  }
}

// Main scan processor
async function processScan(scan) {
  const startTime = Date.now();
  let browser;

  try {
    // Update status to processing
    await supabase
      .from('scans')
      .update({ status: 'processing', claimed_by: WORKER_ID })
      .eq('id', scan.id);

    console.log(`🌐 Launching browser for ${scan.url}`);

    // Check for Browserless first, fallback to local
    const browserlessWS = process.env.BROWSERLESS_WS_URL;
    if (browserlessWS) {
      console.log('🔗 Connecting to Browserless...');
      browser = await chromium.connectOverCDP(browserlessWS);
    } else {
      console.log('🚀 Launching local Chromium...');
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
    }

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (compatible; EqualShield/2.0; +https://equalshield.com/bot)'
    });

    const page = await context.newPage();

    // Navigate with timeout
    await page.goto(scan.url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log(`📸 Extracting canonical page structure...`);

    // EXTRACT: Convert to canonical format
    const canonicalPage = await CanonicalExtractor.extract(page);

    // Take screenshot for report
    const screenshot = await page.screenshot({ fullPage: true });
    // TODO: Upload to S3/Supabase storage

    console.log(`🔍 Running rule engine...`);

    // ANALYZE: Run deterministic rules
    const ruleFindings = RuleEngine.analyze(canonicalPage);

    console.log(`🤖 Running GPT-5 analysis...`);

    // ANALYZE: Run GPT-5 for contextual intelligence
    const aiFindings = await GPT5Analyzer.analyze(canonicalPage, ruleFindings);

    // Combine all findings
    const allFindings = [...ruleFindings, ...aiFindings];

    // Calculate scores
    const criticalCount = allFindings.filter(f => f.severity === 'critical').length;
    const seriousCount = allFindings.filter(f => f.severity === 'serious').length;
    const moderateCount = allFindings.filter(f => f.severity === 'moderate').length;
    const minorCount = allFindings.filter(f => f.severity === 'minor').length;

    const wcagScore = Math.max(0, 100 - (criticalCount * 15) - (seriousCount * 8) - (moderateCount * 3) - (minorCount * 1));
    const adaRiskScore = Math.min(100, (criticalCount * 20) + (seriousCount * 10) + (moderateCount * 3));
    const lawsuitProbability = Math.min(95, 5 + (criticalCount * 12) + (seriousCount * 6));

    console.log(`📊 Results: Score ${wcagScore}, ${allFindings.length} violations found`);

    // Store results
    await supabase
      .from('scans')
      .update({
        status: 'complete',
        canonical_page: canonicalPage, // Store for future reanalysis!
        wcag_score: wcagScore,
        ada_risk_score: adaRiskScore,
        lawsuit_probability: lawsuitProbability.toString(),
        total_violations: allFindings.length,
        critical_violations: criticalCount,
        serious_violations: seriousCount,
        moderate_violations: moderateCount,
        minor_violations: minorCount,
        violations: allFindings,
        processing_time_ms: Date.now() - startTime,
        completed_at: new Date().toISOString()
      })
      .eq('id', scan.id);

    // Store violations in separate table for better querying
    if (allFindings.length > 0) {
      const violationRecords = allFindings.map(f => ({
        scan_id: scan.id,
        wcag_criterion: f.wcagCriterion,
        severity: f.severity,
        element_type: f.elementType,
        element_selector: f.elementSelector,
        element_html: f.elementHtml?.substring(0, 1000),
        page_url: f.pageUrl || scan.url,
        user_impact: f.userImpact,
        business_impact: f.businessImpact,
        legal_risk_level: f.legalRiskLevel,
        fix_description: f.fixDescription,
        fix_code: f.fixCode,
        fix_effort: f.fixEffort,
        estimated_fix_time: f.estimatedFixTime,
        ai_confidence: (f.aiConfidence || 0.8).toString()
      }));

      await supabase.from('violations').insert(violationRecords);
    }

    console.log(`✅ Scan ${scan.id} completed in ${Date.now() - startTime}ms`);

  } catch (error) {
    console.error(`❌ Scan ${scan.id} failed:`, error);

    await supabase
      .from('scans')
      .update({
        status: 'failed',
        error_message: error.message || 'Scan processing failed',
        processing_time_ms: Date.now() - startTime
      })
      .eq('id', scan.id);

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Main worker loop
async function startWorker() {
  console.log('🚀 EqualShield Worker Started');
  console.log(`📡 Worker ID: ${WORKER_ID}`);
  console.log(`🔌 Supabase: ${process.env.SUPABASE_URL}`);
  console.log(`🤖 GPT-5: ${process.env.OPENAI_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`🌐 Browserless: ${process.env.BROWSERLESS_WS_URL ? 'Configured' : 'Local mode'}`);

  while (true) {
    try {
      // Poll for pending scans
      const { data: scans, error } = await supabase
        .from('scans')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) {
        console.error('❌ Error fetching scans:', error);
        await sleep(5000);
        continue;
      }

      if (scans && scans.length > 0) {
        const scan = scans[0];
        console.log(`📋 Processing scan ${scan.id} for ${scan.url}`);
        await processScan(scan);
      } else {
        console.log('😴 No pending scans, waiting...');
        await sleep(5000);
      }

    } catch (error) {
      console.error('❌ Worker error:', error);
      await sleep(5000);
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 Worker shutting down gracefully...');
  process.exit(0);
});

// Start the worker
startWorker().catch(console.error);