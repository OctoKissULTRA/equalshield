// Lazy Stripe client to prevent build-time initialization errors
import Stripe from 'stripe';
import { generateIdempotencyKey } from '@/lib/security/rate-limit';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    
    stripeInstance = new Stripe(key, {
      apiVersion: '2024-12-18', // Use actual supported API version
      typescript: true,
    });
  }
  
  return stripeInstance;
}

// Helper functions for idempotent Stripe operations
export async function createSubscriptionIdempotent(
  customerId: string,
  priceId: string,
  metadata?: Record<string, string>
) {
  const stripe = getStripe();
  const payload = { customer: customerId, items: [{ price: priceId }], metadata };
  const idempotencyKey = generateIdempotencyKey('stripe_sub', payload);
  
  return await stripe.subscriptions.create(payload, { idempotencyKey });
}

export async function createCheckoutSessionIdempotent(
  params: Stripe.Checkout.SessionCreateParams,
  orgId: string
) {
  const stripe = getStripe();
  const idempotencyKey = generateIdempotencyKey(`stripe_checkout_${orgId}`, params);
  
  return await stripe.checkout.sessions.create(params, { idempotencyKey });
}

export async function createCustomerIdempotent(
  email: string,
  name?: string,
  metadata?: Record<string, string>
) {
  const stripe = getStripe();
  const payload = { email, name, metadata };
  const idempotencyKey = generateIdempotencyKey('stripe_customer', payload);
  
  return await stripe.customers.create(payload, { idempotencyKey });
}

// Webhook signature verification
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Stripe.Event {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(payload, signature, secret);
}