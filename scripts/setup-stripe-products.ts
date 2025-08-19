import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function setupStripeProducts() {
  console.log('🚀 Setting up EqualShield Stripe products...\n');

  try {
    // Starter Plan (Beat accessiBe's $59/month)
    const starterProduct = await stripe.products.create({
      name: 'EqualShield Starter',
      description: 'AI-powered accessibility compliance for small businesses. Up to 10,000 page views/month.',
      metadata: {
        plan: 'starter',
        features: 'Up to 10,000 page views, Automated WCAG 2.1 AA scanning, Basic violation reports, Email support'
      }
    });

    const starterPrice = await stripe.prices.create({
      product: starterProduct.id,
      unit_amount: 4900, // $49.00 (beats accessiBe's $59)
      currency: 'usd',
      recurring: {
        interval: 'month'
      },
      metadata: {
        plan: 'starter'
      }
    });

    console.log('✅ Starter Plan Created:');
    console.log(`   Product ID: ${starterProduct.id}`);
    console.log(`   Price ID: ${starterPrice.id}`);
    console.log(`   Amount: $${starterPrice.unit_amount! / 100}/month\n`);

    // Professional Plan (Beat competitors' growth plans)
    const professionalProduct = await stripe.products.create({
      name: 'EqualShield Professional',
      description: 'Complete compliance solution for growing businesses. Up to 50,000 page views/month.',
      metadata: {
        plan: 'professional',
        features: 'Up to 50,000 page views, Advanced WCAG scanning, VPAT generation, Priority email support, Legal risk assessment'
      }
    });

    const professionalPrice = await stripe.prices.create({
      product: professionalProduct.id,
      unit_amount: 14900, // $149.00/month (beats $1,490/year competition)
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

    // Enterprise Plan (Competitive with scale plans)
    const enterpriseProduct = await stripe.products.create({
      name: 'EqualShield Enterprise',
      description: 'Full enterprise compliance suite with unlimited scanning and legal protection.',
      metadata: {
        plan: 'enterprise',
        features: 'Unlimited page views, AI + Human testing, Custom VPAT generation, Dedicated support, Legal protection up to $25k'
      }
    });

    const enterprisePrice = await stripe.prices.create({
      product: enterpriseProduct.id,
      unit_amount: 39900, // $399.00/month (competitive with $3,990/year plans)
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
    console.log(`STRIPE_PRICE_ID_STARTER=${starterPrice.id}`);
    console.log(`STRIPE_PRICE_ID_PROFESSIONAL=${professionalPrice.id}`);
    console.log(`STRIPE_PRICE_ID_ENTERPRISE=${enterprisePrice.id}`);
    console.log(`STRIPE_PRODUCT_ID_STARTER=${starterProduct.id}`);
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