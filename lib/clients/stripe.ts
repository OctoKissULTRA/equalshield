// Lazy Stripe client to prevent build-time initialization errors
import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    
    stripeInstance = new Stripe(key, {
      apiVersion: '2025-07-30.basil', // Version required by Stripe v18.1.0
      typescript: true,
    });
  }
  
  return stripeInstance;
}