// Railway Worker: Job Queue Processor
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';

// Initialize services
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Worker configuration
const WORKER_ID = process.env.WORKER_ID || `railway-${randomUUID()}`;
const POLL_INTERVAL_MS = process.env.POLL_INTERVAL_MS || 5000;
const MAX_RETRIES = 3;

console.log(`🚀 EqualShield Queue Worker Started`);
console.log(`📡 Worker ID: ${WORKER_ID}`);
console.log(`🔌 Supabase: ${process.env.SUPABASE_URL}`);
console.log(`🤖 OpenAI: ${process.env.OPENAI_API_KEY ? 'Configured' : 'Missing'}`);

// Health check server for Railway
import { createServer } from 'http';
const PORT = process.env.PORT || 3000;

createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      worker: WORKER_ID,
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
}).listen(PORT, () => {
  console.log(`🏥 Health check server on port ${PORT}`);
});

// Claim next job from queue
async function claimJob() {
  try {
    const { data, error } = await supabase.rpc('claim_next_job', { 
      p_worker_id: WORKER_ID 
    });
    
    if (error) {
      console.error('❌ Error claiming job:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('❌ Claim job error:', error);
    return null;
  }
}

// Process a single scan job
async function processScanJob(job) {
  const startTime = Date.now();
  let browser;

  try {
    console.log(`🔄 Processing job ${job.id}: ${job.url}`);
    
    // Mark as processing
    await supabase
      .from('scan_jobs')
      .update({ status: 'processing' })
      .eq('id', job.id);

    // Launch browser
    console.log(`🌐 Launching browser for ${job.url}`);
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
    await page.goto(job.url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log(`📸 Extracting page structure for ${job.url}`);

    // Extract page structure (simplified from your existing code)
    const pageData = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        headings: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({
          level: parseInt(h.tagName[1]),
          text: h.textContent.trim()
        })),
        images: Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.src,
          alt: img.alt || '',
          hasAlt: !!img.alt
        })),
        links: Array.from(document.querySelectorAll('a[href]')).map(a => ({
          text: a.textContent.trim(),
          href: a.href
        })),
        forms: Array.from(document.querySelectorAll('form')).map(form => ({
          inputs: Array.from(form.querySelectorAll('input,select,textarea')).map(input => ({
            type: input.type || input.tagName.toLowerCase(),
            hasLabel: !!document.querySelector(`label[for="${input.id}"]`) || !!input.getAttribute('aria-label')
          }))
        }))
      };
    });

    // Run basic accessibility analysis
    const violations = [];
    
    // Check images without alt text
    pageData.images.forEach((img, idx) => {
      if (!img.hasAlt && img.src && !img.src.includes('data:')) {
        violations.push({
          wcagCriterion: '1.1.1',
          severity: 'critical',
          elementType: 'image',
          description: 'Image missing alt text',
          impact: 'Screen readers cannot describe this image',
          fixDescription: 'Add descriptive alt text to the image'
        });
      }
    });

    // Check form inputs without labels
    pageData.forms.forEach(form => {
      form.inputs.forEach(input => {
        if (!input.hasLabel && input.type !== 'hidden' && input.type !== 'submit') {
          violations.push({
            wcagCriterion: '3.3.2',
            severity: 'serious',
            elementType: 'form',
            description: 'Form input missing label',
            impact: 'Users cannot determine the purpose of this input field',
            fixDescription: 'Add a label for this input field'
          });
        }
      });
    });

    // Check heading hierarchy
    let lastLevel = 0;
    pageData.headings.forEach((heading, idx) => {
      if (idx === 0 && heading.level !== 1) {
        violations.push({
          wcagCriterion: '1.3.1',
          severity: 'moderate',
          elementType: 'heading',
          description: 'Page should start with H1',
          impact: 'Document structure is confusing for screen readers',
          fixDescription: 'Start page with an H1 heading'
        });
      }
      if (heading.level - lastLevel > 1) {
        violations.push({
          wcagCriterion: '1.3.1',
          severity: 'minor',
          elementType: 'heading',
          description: `Heading hierarchy skip from H${lastLevel} to H${heading.level}`,
          impact: 'Breaks logical document structure',
          fixDescription: 'Use proper heading hierarchy'
        });
      }
      lastLevel = heading.level;
    });

    // GPT-5 Analysis (if API key available)
    let aiAnalysis = null;
    if (process.env.OPENAI_API_KEY && violations.length > 0) {
      try {
        console.log(`🤖 Running GPT-5 analysis...`);
        
        const prompt = `Analyze this webpage accessibility scan:
URL: ${job.url}
Violations found: ${violations.length}
Sample violations: ${JSON.stringify(violations.slice(0, 3), null, 2)}

Provide a brief analysis in JSON format:
{
  "summary": "Brief summary of main issues",
  "riskLevel": "low|medium|high|critical",
  "prioritizedFixes": ["Most important fix", "Second priority", "Third priority"],
  "estimatedCost": "Estimated development time"
}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-5-2025-08-07",
          messages: [
            {
              role: "system",
              content: "You are an accessibility expert. Provide practical analysis for business owners."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_completion_tokens: 300,
          temperature: 0.3
        });

        aiAnalysis = JSON.parse(completion.choices[0]?.message?.content || '{}');
      } catch (error) {
        console.error('GPT-5 analysis failed:', error);
      }
    }

    // Calculate scores
    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const seriousCount = violations.filter(v => v.severity === 'serious').length;
    const moderateCount = violations.filter(v => v.severity === 'moderate').length;
    const minorCount = violations.filter(v => v.severity === 'minor').length;

    const wcagScore = Math.max(0, 100 - (criticalCount * 15) - (seriousCount * 8) - (moderateCount * 3) - (minorCount * 1));
    const adaRiskScore = Math.min(100, (criticalCount * 20) + (seriousCount * 10) + (moderateCount * 3));
    const lawsuitProbability = Math.min(95, 5 + (criticalCount * 12) + (seriousCount * 6));

    console.log(`📊 Analysis complete: Score ${wcagScore}, ${violations.length} violations`);

    // Save scan results to main database
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .insert({
        team_id: parseInt(job.org_id),
        url: job.url,
        domain: new URL(job.url).hostname,
        wcag_score: wcagScore,
        ada_risk_score: adaRiskScore,
        lawsuit_probability: lawsuitProbability.toString(),
        total_violations: violations.length,
        critical_violations: criticalCount,
        serious_violations: seriousCount,
        moderate_violations: moderateCount,
        minor_violations: minorCount,
        violations: violations,
        ai_analysis: aiAnalysis,
        status: 'complete',
        processing_time_ms: Date.now() - startTime,
        completed_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (scanError) {
      throw new Error(`Failed to save scan: ${scanError.message}`);
    }

    // Mark job as complete
    await supabase.rpc('complete_job', { 
      p_job_id: job.id, 
      p_scan_id: scan.id 
    });

    console.log(`✅ Job ${job.id} completed successfully in ${Date.now() - startTime}ms`);
    
    // Update worker heartbeat
    await supabase.rpc('update_worker_heartbeat', {
      p_worker_id: WORKER_ID,
      p_jobs_processed: 1
    });

    return true;

  } catch (error) {
    console.error(`❌ Job ${job.id} failed:`, error);
    
    // Mark job as failed
    await supabase.rpc('fail_job', { 
      p_job_id: job.id, 
      p_error: error.message || 'Processing failed' 
    });
    
    return false;

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Main worker loop
async function runWorkerLoop() {
  let idleMs = 1000;
  
  while (true) {
    try {
      // Send heartbeat
      await supabase.rpc('update_worker_heartbeat', {
        p_worker_id: WORKER_ID,
        p_jobs_processed: null
      });

      // Try to claim and process a job
      const job = await claimJob();
      
      if (job) {
        console.log(`📋 Claimed job ${job.id}: ${job.url} (${job.depth})`);
        const success = await processScanJob(job);
        idleMs = success ? 100 : 2000; // Reset backoff on success
      } else {
        console.log('😴 No jobs available, waiting...');
        idleMs = Math.min(POLL_INTERVAL_MS, idleMs * 1.2); // Gradual backoff
      }
      
    } catch (error) {
      console.error('❌ Worker loop error:', error);
      idleMs = Math.min(10000, idleMs * 2); // Backoff on error
    }
    
    await new Promise(resolve => setTimeout(resolve, idleMs));
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 Worker shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 Worker interrupted, shutting down...');
  process.exit(0);
});

// Start the worker
runWorkerLoop().catch(error => {
  console.error('💥 Worker crashed:', error);
  process.exit(1);
});