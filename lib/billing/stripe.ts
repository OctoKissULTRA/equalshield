import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18',
  typescript: true,
});

// Product and pricing configuration
export const STRIPE_CONFIG = {
  products: {
    starter: {
      name: 'EqualShield Starter',
      description: 'Perfect for small websites and getting started with accessibility compliance',
      metadata: {
        tier: 'starter',
        pages_per_scan: '5',
        scans_per_month: '10',
        features: JSON.stringify({
          pdf: false,
          vpat: false,
          api: false,
          share_links: true,
          watermark: true,
          support: 'email'
        })
      }
    },
    pro: {
      name: 'EqualShield Pro',
      description: 'Advanced scanning with professional reports and API access for growing teams',
      metadata: {
        tier: 'pro',
        pages_per_scan: '50',
        scans_per_month: '100',
        features: JSON.stringify({
          pdf: true,
          vpat: true,
          api: true,
          share_links: true,
          watermark: false,
          support: 'priority',
          sso: false
        })
      }
    },
    enterprise: {
      name: 'EqualShield Enterprise',
      description: 'Unlimited scanning with custom features, dedicated support, and enterprise SLA',
      metadata: {
        tier: 'enterprise',
        pages_per_scan: '500',
        scans_per_month: '1000',
        features: JSON.stringify({
          pdf: true,
          vpat: true,
          api: true,
          share_links: true,
          watermark: false,
          support: 'dedicated',
          sso: true,
          custom_branding: true,
          compliance_reports: true,
          audit_logs: true
        })
      }
    }
  },
  prices: {
    starter: {
      monthly: {
        unit_amount: 2900, // $29.00
        currency: 'usd',
        recurring: { interval: 'month' }
      },
      yearly: {
        unit_amount: 29000, // $290.00 (2 months free)
        currency: 'usd',
        recurring: { interval: 'year' }
      }
    },
    pro: {
      monthly: {
        unit_amount: 9900, // $99.00
        currency: 'usd',
        recurring: { interval: 'month' }
      },
      yearly: {
        unit_amount: 99000, // $990.00 (2 months free)
        currency: 'usd',
        recurring: { interval: 'year' }
      }
    },
    enterprise: {
      monthly: {
        unit_amount: 49900, // $499.00
        currency: 'usd',
        recurring: { interval: 'month' }
      },
      yearly: {
        unit_amount: 499000, // $4,990.00 (2 months free)
        currency: 'usd',
        recurring: { interval: 'year' }
      }
    }
  }
} as const;

export type TierName = keyof typeof STRIPE_CONFIG.products;
export type BillingInterval = 'monthly' | 'yearly';

// Tier configuration for entitlements
export const TIER_CONFIGS = {
  free: {
    pages_per_scan: 3,
    scans_per_month: 3,
    features: {
      pdf: false,
      vpat: false,
      api: false,
      share_links: false,
      watermark: true,
      support: 'community'
    }
  },
  starter: {
    pages_per_scan: 5,
    scans_per_month: 10,
    features: {
      pdf: false,
      vpat: false,
      api: false,
      share_links: true,
      watermark: true,
      support: 'email'
    }
  },
  pro: {
    pages_per_scan: 50,
    scans_per_month: 100,
    features: {
      pdf: true,
      vpat: true,
      api: true,
      share_links: true,
      watermark: false,
      support: 'priority',
      sso: false
    }
  },
  enterprise: {
    pages_per_scan: 500,
    scans_per_month: 1000,
    features: {
      pdf: true,
      vpat: true,
      api: true,
      share_links: true,
      watermark: false,
      support: 'dedicated',
      sso: true,
      custom_branding: true,
      compliance_reports: true,
      audit_logs: true
    }
  }
} as const;

export type Tier = keyof typeof TIER_CONFIGS;

// Helper functions
export function priceIdToTier(priceId: string): Tier {
  // Map Stripe price IDs to tiers
  // This will be populated after products are created
  const priceMap: Record<string, Tier> = {
    [process.env.STRIPE_PRICE_STARTER_MONTHLY || '']: 'starter',
    [process.env.STRIPE_PRICE_STARTER_YEARLY || '']: 'starter',
    [process.env.STRIPE_PRICE_PRO_MONTHLY || '']: 'pro',
    [process.env.STRIPE_PRICE_PRO_YEARLY || '']: 'pro',
    [process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || '']: 'enterprise',
    [process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || '']: 'enterprise',
  };
  
  return priceMap[priceId] || 'free';
}

export function tierToConfig(tier: Tier) {
  return TIER_CONFIGS[tier];
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

// Stripe customer management
export async function createOrGetCustomer(
  email: string,
  orgId: string,
  orgName: string
): Promise<Stripe.Customer> {
  // Check if customer already exists
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    const customer = existingCustomers.data[0];
    
    // Update metadata if needed
    if (customer.metadata.org_id !== orgId) {
      return await stripe.customers.update(customer.id, {
        metadata: {
          org_id: orgId,
          org_name: orgName,
        },
      });
    }
    
    return customer;
  }

  // Create new customer
  return await stripe.customers.create({
    email,
    name: orgName,
    metadata: {
      org_id: orgId,
      org_name: orgName,
    },
  });
}

// Checkout session creation
export async function createCheckoutSession({
  customerId,
  priceId,
  orgId,
  tier,
  interval,
  successUrl,
  cancelUrl,
}: {
  customerId: string;
  priceId: string;
  orgId: string;
  tier: TierName;
  interval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  return await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    tax_id_collection: {
      enabled: true,
    },
    customer_update: {
      name: 'auto',
      address: 'auto',
    },
    metadata: {
      org_id: orgId,
      tier,
      interval,
    },
    subscription_data: {
      metadata: {
        org_id: orgId,
        tier,
        interval,
      },
    },
  });
}

// Customer portal session
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

// Get customer's active subscription
export async function getActiveSubscription(
  customerId: string
): Promise<Stripe.Subscription | null> {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 1,
  });

  return subscriptions.data[0] || null;
}

// Usage reporting for metered billing (if needed in future)
export async function reportUsage(
  subscriptionItemId: string,
  quantity: number,
  timestamp?: number
): Promise<Stripe.UsageRecord> {
  return await stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
    quantity,
    timestamp: timestamp || Math.floor(Date.now() / 1000),
    action: 'increment',
  });
}

// Invoice management
export async function getCustomerInvoices(
  customerId: string,
  limit: number = 10
): Promise<Stripe.Invoice[]> {
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
  });

  return invoices.data;
}

// Payment method management
export async function getCustomerPaymentMethods(
  customerId: string
): Promise<Stripe.PaymentMethod[]> {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
  });

  return paymentMethods.data;
}

// Subscription management
export async function updateSubscription(
  subscriptionId: string,
  updates: Partial<Stripe.SubscriptionUpdateParams>
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.update(subscriptionId, updates);
}

export async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<Stripe.Subscription> {
  if (cancelAtPeriodEnd) {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    return await stripe.subscriptions.cancel(subscriptionId);
  }
}

// Webhook signature verification
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

// Price utilities
export function getPriceId(tier: TierName, interval: BillingInterval): string {
  const envMap = {
    starter: {
      monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
      yearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
    },
    pro: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
      yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    },
    enterprise: {
      monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
      yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY,
    },
  };

  const priceId = envMap[tier]?.[interval];
  if (!priceId) {
    throw new Error(`Price ID not found for tier ${tier} interval ${interval}`);
  }

  return priceId;
}

// Feature flag helpers
export function hasFeature(tier: Tier, feature: string): boolean {
  const config = TIER_CONFIGS[tier];
  return (config.features as any)[feature] === true;
}

export function canAccessFeature(
  tier: Tier,
  feature: keyof (typeof TIER_CONFIGS)[Tier]['features']
): boolean {
  const config = TIER_CONFIGS[tier];
  return config.features[feature] === true;
}

// Upgrade/downgrade helpers
export function getUpgradePath(currentTier: Tier): Tier | null {
  const upgradePaths: Record<Tier, Tier | null> = {
    free: 'starter',
    starter: 'pro',
    pro: 'enterprise',
    enterprise: null,
  };

  return upgradePaths[currentTier];
}

export function isUpgrade(fromTier: Tier, toTier: Tier): boolean {
  const tierOrder: Tier[] = ['free', 'starter', 'pro', 'enterprise'];
  return tierOrder.indexOf(toTier) > tierOrder.indexOf(fromTier);
}