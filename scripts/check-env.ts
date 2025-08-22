#!/usr/bin/env npx tsx
/**
 * Environment Configuration Checker
 * 
 * Validates all environment variables and shows what's missing or invalid
 * Usage: npm run env:check
 */

import "dotenv/config";
import { EnvSchema } from "../lib/config/env";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m"
};

// Mask sensitive values for display
const mask = (value?: string, key?: string): string => {
  if (!value) return colors.gray + "(unset)" + colors.reset;
  
  // Never mask public keys or non-sensitive values
  const publicKeys = ["NEXT_PUBLIC_", "NODE_ENV", "FEATURE_", "LLM_MODEL", "SENTRY_ENVIRONMENT"];
  if (key && publicKeys.some(prefix => key.startsWith(prefix))) {
    return colors.cyan + value + colors.reset;
  }
  
  // URLs - show domain but mask credentials
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("postgres://")) {
    try {
      const url = new URL(value);
      const masked = `${url.protocol}//${url.hostname}${url.port ? ':' + url.port : ''}${url.pathname}`;
      return colors.cyan + masked + colors.reset;
    } catch {
      // Fall through to default masking
    }
  }
  
  // API keys and secrets - show prefix and suffix
  if (value.length <= 8) {
    return colors.gray + "*".repeat(value.length) + colors.reset;
  }
  
  const prefix = value.slice(0, 4);
  const suffix = value.slice(-2);
  return colors.gray + `${prefix}...${suffix}` + colors.reset;
};

// Check which env files exist
const checkEnvFiles = () => {
  const files = [
    ".env",
    ".env.local",
    ".env.production",
    ".env.production.local",
    ".env.development",
    ".env.development.local"
  ];
  
  console.log("\n📁 Environment Files:");
  files.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    const exists = fs.existsSync(filePath);
    const icon = exists ? "✅" : "❌";
    const color = exists ? colors.green : colors.gray;
    console.log(`  ${icon} ${color}${file}${colors.reset}`);
  });
};

// Main validation
console.log(colors.bright + "🔍 EqualShield Environment Check\n" + colors.reset);

// Show which env files are present
checkEnvFiles();

console.log("\n🔐 Validating Environment Variables:");
console.log("=" + "=".repeat(50));

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("\n" + colors.red + "❌ Validation Failed!" + colors.reset + "\n");
  
  // Group errors by category
  const errors: Record<string, z.ZodIssue[]> = {};
  
  parsed.error.issues.forEach(issue => {
    const key = issue.path[0] as string || "general";
    let category = "Other";
    
    if (key.includes("STRIPE")) category = "Stripe";
    else if (key.includes("SUPABASE") || key.includes("DATABASE")) category = "Database";
    else if (key.includes("LLM") || key.includes("OPENAI") || key.includes("AI")) category = "AI/LLM";
    else if (key.includes("CRON") || key.includes("SELF_SCAN") || key.includes("TRUST")) category = "Cron/Trust";
    else if (key.includes("SENTRY")) category = "Observability";
    else if (key.includes("FEATURE")) category = "Features";
    else if (key.includes("REDIS") || key.includes("UPSTASH")) category = "Rate Limiting";
    
    if (!errors[category]) errors[category] = [];
    errors[category].push(issue);
  });
  
  // Display errors by category
  Object.entries(errors).forEach(([category, issues]) => {
    console.log(`\n${colors.yellow}📦 ${category}:${colors.reset}`);
    issues.forEach(issue => {
      const key = issue.path.join(".");
      const currentValue = process.env[key];
      console.error(`  ${colors.red}✗${colors.reset} ${colors.bright}${key}${colors.reset}`);
      console.error(`    ${colors.gray}Error: ${issue.message}${colors.reset}`);
      if (currentValue) {
        console.error(`    ${colors.gray}Current: ${mask(currentValue, key)}${colors.reset}`);
      }
    });
  });
  
  console.log("\n" + colors.yellow + "💡 Quick Fixes:" + colors.reset);
  console.log("  1. Copy .env.example to .env.local");
  console.log("  2. Fill in the missing values");
  console.log("  3. Run 'npm run env:check' again");
  console.log("\n" + colors.gray + "For production, set these in your hosting provider's dashboard" + colors.reset);
  
  process.exit(1);
}

// Success! Show the validated environment
console.log("\n" + colors.green + "✅ All environment variables are valid!" + colors.reset + "\n");

// Get all keys from schema
const schemaKeys = Object.keys((EnvSchema as any).shape) as string[];

// Group keys by category for organized display
const categories: Record<string, string[]> = {
  "🏗️  Core": ["NODE_ENV", "DATABASE_URL"],
  "🗄️  Supabase": schemaKeys.filter(k => k.includes("SUPABASE")),
  "🌐 App": ["NEXT_PUBLIC_APP_URL"],
  "💳 Stripe": schemaKeys.filter(k => k.includes("STRIPE")),
  "🤖 AI/LLM": schemaKeys.filter(k => k.includes("LLM") || k.includes("OPENAI") || k.includes("AI")),
  "⏰ Cron & Trust": schemaKeys.filter(k => k.includes("CRON") || k.includes("SELF_SCAN") || k.includes("TRUST")),
  "🚦 Rate Limiting": schemaKeys.filter(k => k.includes("REDIS") || k.includes("UPSTASH") || k === "RATE_LIMIT_BACKEND"),
  "📊 Observability": schemaKeys.filter(k => k.includes("SENTRY")),
  "⚙️  Worker": ["WORKER_ID", "POLL_INTERVAL_MS", "MAX_RETRIES", "SCAN_MAX_CONCURRENCY", "SCAN_MAX_PAGES_OVERRIDE"],
  "💾 Cache": ["XDG_CACHE_HOME", "PLAYWRIGHT_BROWSERS_PATH", "PUPPETEER_CACHE_DIR"],
  "🎛️  Features": schemaKeys.filter(k => k.startsWith("FEATURE")),
  "📧 Email": schemaKeys.filter(k => k.includes("EMAIL") || k.includes("RESEND")),
  "🔐 Security": ["JWT_SECRET", "SESSION_COOKIE_NAME", "ALLOWED_ORIGINS", "CSP_REPORT_URI"]
};

// Display by category
Object.entries(categories).forEach(([category, keys]) => {
  const relevantKeys = keys.filter(k => schemaKeys.includes(k));
  if (relevantKeys.length === 0) return;
  
  console.log(`\n${category}`);
  console.log("  " + "-".repeat(48));
  
  relevantKeys.forEach(key => {
    const value = process.env[key];
    const displayValue = mask(value, key);
    const status = value ? "✓" : "○";
    const statusColor = value ? colors.green : colors.gray;
    
    // Align the output nicely
    const keyDisplay = key.padEnd(30);
    console.log(`  ${statusColor}${status}${colors.reset} ${keyDisplay} ${displayValue}`);
  });
});

// Show summary statistics
const setCount = schemaKeys.filter(k => process.env[k]).length;
const totalCount = schemaKeys.length;
const percentage = Math.round((setCount / totalCount) * 100);

console.log("\n" + "=".repeat(52));
console.log(`\n📊 Summary: ${colors.bright}${setCount}/${totalCount}${colors.reset} variables set (${percentage}%)`);

// Feature status
console.log("\n🎯 Feature Status:");
const features = [
  { name: "AI Insights", enabled: process.env.AI_SUMMARIZER_ENABLED === "true" },
  { name: "Trial System", enabled: process.env.FEATURE_TRIAL_ENABLED === "true" },
  { name: "Share Links", enabled: process.env.FEATURE_SHARE_ENABLED === "true" },
  { name: "VPAT Export", enabled: process.env.FEATURE_VPAT_EXPORT === "true" },
  { name: "Watermarks", enabled: process.env.FEATURES_WATERMARK_TRIAL === "true" }
];

features.forEach(feature => {
  const icon = feature.enabled ? "✅" : "⭕";
  const color = feature.enabled ? colors.green : colors.gray;
  console.log(`  ${icon} ${color}${feature.name}${colors.reset}`);
});

// Warnings for production
if (process.env.NODE_ENV === "production") {
  console.log("\n" + colors.yellow + "⚠️  Production Warnings:" + colors.reset);
  
  if (!process.env.SENTRY_DSN) {
    console.log("  • Sentry error tracking not configured");
  }
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    console.log("  • Using in-memory rate limiting (not persistent)");
  }
  if (process.env.AI_SUMMARIZER_ENABLED !== "true") {
    console.log("  • AI insights disabled");
  }
}

console.log("\n" + colors.green + "✨ Environment is ready for deployment!" + colors.reset + "\n");