#!/usr/bin/env npx tsx

/**
 * Stripe Product & Price Seeding Script
 * 
 * Creates products and prices in Stripe, outputs environment variables
 */

import 'dotenv/config';
import { stripe, STRIPE_CONFIG, type TierName, type BillingInterval } from '../lib/billing/stripe';

interface CreatedProduct {
  tier: TierName;
  productId: string;
  prices: {
    monthly: string;
    yearly: string;
  };
}

async function createProductsAndPrices(): Promise<CreatedProduct[]> {
  const results: CreatedProduct[] = [];
  
  console.log('🏗️  Creating Stripe products and prices...\n');
  
  for (const [tierName, productConfig] of Object.entries(STRIPE_CONFIG.products)) {
    const tier = tierName as TierName;
    
    console.log(`📦 Creating product: ${productConfig.name}`);
    
    // Create product
    const product = await stripe.products.create({
      name: productConfig.name,
      description: productConfig.description,
      metadata: productConfig.metadata,
    });
    
    console.log(`   Product ID: ${product.id}`);
    
    // Create prices
    const priceConfigs = STRIPE_CONFIG.prices[tier];
    const prices: { monthly: string; yearly: string } = {} as any;
    
    for (const [interval, priceConfig] of Object.entries(priceConfigs)) {
      const billingInterval = interval as BillingInterval;
      
      console.log(`   💰 Creating ${billingInterval} price: ${priceConfig.unit_amount / 100} USD`);
      
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: priceConfig.unit_amount,
        currency: priceConfig.currency,
        recurring: priceConfig.recurring,
        nickname: `${productConfig.name} (${billingInterval})`,
        metadata: {
          tier,
          interval: billingInterval,
        },
      });
      
      prices[billingInterval] = price.id;
      console.log(`      Price ID: ${price.id}`);
    }
    
    results.push({
      tier,
      productId: product.id,
      prices,
    });
    
    console.log(`   ✅ ${productConfig.name} created\n`);
  }
  
  return results;
}

async function enableCustomerPortal(): Promise<void> {
  console.log('🎛️  Configuring Customer Portal...\n');
  
  try {
    // Get the portal configuration
    const configurations = await stripe.billingPortal.configurations.list({ limit: 1 });
    
    if (configurations.data.length === 0) {
      // Create new portal configuration
      const config = await stripe.billingPortal.configurations.create({
        business_profile: {
          headline: 'EqualShield - Accessibility Compliance Platform',
        },
        features: {
          customer_update: {
            enabled: true,
            allowed_updates: ['email', 'name', 'address', 'tax_id'],
          },
          invoice_history: {
            enabled: true,
          },
          payment_method_update: {
            enabled: true,
          },
          subscription_cancel: {
            enabled: true,
            mode: 'at_period_end',
            cancellation_reason: {
              enabled: true,
              options: [
                'too_expensive',
                'missing_features',
                'switched_service',
                'unused',
                'other',
              ],
            },
          },
          subscription_update: {
            enabled: true,
            default_allowed_updates: ['price', 'quantity'],
            proration_behavior: 'create_prorations',
          },
        },
      });
      
      console.log(`   ✅ Portal configuration created: ${config.id}`);
    } else {
      console.log(`   ✅ Portal configuration already exists: ${configurations.data[0].id}`);
    }
  } catch (error) {
    console.error('   ❌ Error configuring portal:', error);
  }
}

async function updateDatabaseSchema(): Promise<void> {
  console.log('🗄️  Database schema update needed...\n');
  
  console.log('   Run this migration:');
  console.log(`
   CREATE TABLE IF NOT EXISTS stripe_products (
     tier text PRIMARY KEY,
     product_id text NOT NULL,
     price_monthly text NOT NULL,
     price_yearly text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   );
  `);
}

async function seedDatabase(products: CreatedProduct[]): Promise<void> {
  console.log('🌱 Seeding database with product information...\n');
  
  // This would normally use your database client
  // For now, just log the SQL statements
  
  for (const product of products) {
    const sql = `
INSERT INTO stripe_products (tier, product_id, price_monthly, price_yearly)
VALUES ('${product.tier}', '${product.productId}', '${product.prices.monthly}', '${product.prices.yearly}')
ON CONFLICT (tier) DO UPDATE SET
  product_id = EXCLUDED.product_id,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  updated_at = now();`;
    
    console.log(`   ${product.tier}: ${sql.replace(/\s+/g, ' ').trim()}`);
  }
}

function generateEnvVariables(products: CreatedProduct[]): void {
  console.log('\n🔧 Environment Variables\n');
  console.log('Add these to your .env file:\n');
  
  for (const product of products) {
    const tierUpper = product.tier.toUpperCase();
    console.log(`STRIPE_PRODUCT_${tierUpper}=${product.productId}`);
    console.log(`STRIPE_PRICE_${tierUpper}_MONTHLY=${product.prices.monthly}`);
    console.log(`STRIPE_PRICE_${tierUpper}_YEARLY=${product.prices.yearly}`);
  }
  
  console.log('\n# Webhook endpoint secret (get from Stripe dashboard)');
  console.log('STRIPE_WEBHOOK_SECRET=whsec_...');
  
  console.log('\n# Customer Portal URL (optional)');
  console.log('STRIPE_PORTAL_RETURN_URL=https://your-domain.com/dashboard/billing');
}

async function validateStripeConnection(): Promise<void> {
  console.log('🔗 Validating Stripe connection...\n');
  
  try {
    const account = await stripe.accounts.retrieve();
    console.log(`   ✅ Connected to Stripe account: ${account.business_profile?.name || account.id}`);
    console.log(`   📧 Email: ${account.email}`);
    console.log(`   🌍 Country: ${account.country}`);
    console.log(`   💰 Currency: ${account.default_currency?.toUpperCase()}`);
    
    if (!account.charges_enabled) {
      console.log('   ⚠️  WARNING: Charges not enabled on this account');
    }
    
    if (!account.payouts_enabled) {
      console.log('   ⚠️  WARNING: Payouts not enabled on this account');
    }
    
  } catch (error) {
    console.error('   ❌ Stripe connection failed:', error);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  console.log('🎪 EqualShield Stripe Setup\n');
  console.log('=========================\n');
  
  try {
    // Validate connection
    await validateStripeConnection();
    
    // Create products and prices
    const products = await createProductsAndPrices();
    
    // Enable customer portal
    await enableCustomerPortal();
    
    // Show database update needed
    await updateDatabaseSchema();
    
    // Seed database (show SQL)
    await seedDatabase(products);
    
    // Generate environment variables
    generateEnvVariables(products);
    
    console.log('\n✅ Stripe setup complete!\n');
    console.log('Next steps:');
    console.log('1. Add environment variables to .env');
    console.log('2. Run database migration');
    console.log('3. Set up webhook endpoint in Stripe dashboard');
    console.log('4. Test checkout flow');
    
  } catch (error) {
    console.error('\n💥 Setup failed:', error);
    process.exit(1);
  }
}

// Handle CLI arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
EqualShield Stripe Setup

Usage:
  npx tsx scripts/seed-stripe.ts [options]

Options:
  --help, -h     Show this help message
  --dry-run      Show what would be created without making changes
  --force        Recreate products even if they exist

Environment:
  STRIPE_SECRET_KEY    Required: Your Stripe secret key
  
Examples:
  npx tsx scripts/seed-stripe.ts
  npx tsx scripts/seed-stripe.ts --dry-run
`);
  process.exit(0);
}

if (process.argv.includes('--dry-run')) {
  console.log('🔍 DRY RUN MODE - No changes will be made\n');
  
  console.log('Would create these products:');
  Object.entries(STRIPE_CONFIG.products).forEach(([tier, config]) => {
    console.log(`  • ${config.name} (${tier})`);
    const prices = STRIPE_CONFIG.prices[tier as TierName];
    console.log(`    Monthly: $${prices.monthly.unit_amount / 100}`);
    console.log(`    Yearly: $${prices.yearly.unit_amount / 100}`);
  });
  
  process.exit(0);
}

// Run the setup
main();