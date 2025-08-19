import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function setupStripeProducts() {
  console.log('🚀 Setting up EqualShield Stripe products...\n');

  try {
    // Professional Plan
    const professionalProduct = await stripe.products.create({
      name: 'EqualShield Professional',
      description: 'Complete WCAG 2.1 AA compliance scanning and VPAT generation for growing businesses',
      metadata: {
        plan: 'professional',
        features: 'Monthly scans, Basic VPAT generation, Email support'
      }
    });

    const professionalPrice = await stripe.prices.create({
      product: professionalProduct.id,
      unit_amount: 99700, // $997.00
      currency: 'usd',
      recurring: {
        interval: 'month'
      },
      metadata: {
        plan: 'professional'
      }
    });

    console.log('✅ Professional Plan Created:');
    console.log(`   Product ID: ${professionalProduct.id}`);
    console.log(`   Price ID: ${professionalPrice.id}`);
    console.log(`   Amount: $${professionalPrice.unit_amount! / 100}/month\n`);

    // Enterprise Plan
    const enterpriseProduct = await stripe.products.create({
      name: 'EqualShield Enterprise',
      description: 'Advanced compliance platform with unlimited scans, priority support, and custom integrations',
      metadata: {
        plan: 'enterprise',
        features: 'Unlimited scans, Advanced VPAT, Priority support, Custom integrations'
      }
    });

    const enterprisePrice = await stripe.prices.create({
      product: enterpriseProduct.id,
      unit_amount: 249700, // $2,497.00
      currency: 'usd',
      recurring: {
        interval: 'month'
      },
      metadata: {
        plan: 'enterprise'
      }
    });

    console.log('✅ Enterprise Plan Created:');
    console.log(`   Product ID: ${enterpriseProduct.id}`);
    console.log(`   Price ID: ${enterprisePrice.id}`);
    console.log(`   Amount: $${enterprisePrice.unit_amount! / 100}/month\n`);

    // Global Plan (Contact for pricing)
    const globalProduct = await stripe.products.create({
      name: 'EqualShield Global',
      description: 'Enterprise-grade solution for Fortune 500 companies with global compliance requirements',
      metadata: {
        plan: 'global',
        features: 'Multi-region compliance, Dedicated support, Custom SLAs, Advanced reporting'
      }
    });

    // No price for Global - it's custom pricing
    console.log('✅ Global Plan Created (Custom Pricing):');
    console.log(`   Product ID: ${globalProduct.id}\n`);

    // Environment Variables
    console.log('🔧 ADD THESE TO YOUR VERCEL ENVIRONMENT VARIABLES:');
    console.log('================================================');
    console.log(`STRIPE_PRICE_ID_PROFESSIONAL=${professionalPrice.id}`);
    console.log(`STRIPE_PRICE_ID_ENTERPRISE=${enterprisePrice.id}`);
    console.log(`STRIPE_PRODUCT_ID_PROFESSIONAL=${professionalProduct.id}`);
    console.log(`STRIPE_PRODUCT_ID_ENTERPRISE=${enterpriseProduct.id}`);
    console.log(`STRIPE_PRODUCT_ID_GLOBAL=${globalProduct.id}\n`);

    // Update your .env file
    console.log('💡 Also add to your local .env file for development!');

  } catch (error) {
    console.error('❌ Error setting up Stripe products:', error);
    
    if (error instanceof Error && error.message.includes('No such API key')) {
      console.error('\n💡 Make sure your STRIPE_SECRET_KEY is set in your .env file');
    }
  }
}

// Run the setup
if (require.main === module) {
  setupStripeProducts();
}

export { setupStripeProducts };