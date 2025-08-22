import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { verifyWebhookSignature, priceIdToTier, tierToConfig } from '@/lib/billing/stripe';
import { entitlementsService } from '@/lib/entitlements';
import { createSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = headers().get('stripe-signature') as string;
  
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = verifyWebhookSignature(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`📨 Received webhook: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event);
        break;
        
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(event);
        break;
        
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event);
        break;
        
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event);
        break;
        
      default:
        console.log(`🤷 Unhandled webhook event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleSubscriptionChange(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  
  console.log(`🔄 Processing subscription change: ${subscription.id}`);
  
  const orgId = await mapCustomerToOrg(subscription.customer as string);
  if (!orgId) {
    console.error('No organization found for customer:', subscription.customer);
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    console.error('No price ID found in subscription:', subscription.id);
    return;
  }

  const tier = priceIdToTier(priceId);
  const tierConfig = tierToConfig(tier);

  let status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing' = 'active';
  
  switch (subscription.status) {
    case 'active':
      status = 'active';
      break;
    case 'canceled':
      status = 'canceled';
      break;
    case 'past_due':
      status = 'past_due';
      break;
    case 'incomplete':
    case 'incomplete_expired':
      status = 'incomplete';
      break;
    case 'trialing':
      status = 'trialing';
      break;
    default:
      status = 'active';
  }

  const entitlementUpdates = {
    tier,
    pages_per_scan: tierConfig.pages_per_scan,
    scans_per_month: tierConfig.scans_per_month,
    features: tierConfig.features,
    period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    stripe_customer_id: subscription.customer as string,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    status,
    trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
  };

  await entitlementsService.updateEntitlements(orgId, entitlementUpdates);

  await entitlementsService.logBillingEvent(
    orgId,
    'subscription_updated',
    {
      subscription_id: subscription.id,
      tier,
      status,
      period_start: entitlementUpdates.period_start,
      period_end: entitlementUpdates.period_end
    },
    event.id
  );

  console.log(`✅ Updated entitlements for org ${orgId}: ${tier} (${status})`);
}

async function handleSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  
  const orgId = await mapCustomerToOrg(subscription.customer as string);
  if (!orgId) return;

  const freeConfig = tierToConfig('free');
  
  const entitlementUpdates = {
    tier: 'free' as const,
    pages_per_scan: freeConfig.pages_per_scan,
    scans_per_month: freeConfig.scans_per_month,
    features: freeConfig.features,
    period_start: null,
    period_end: null,
    stripe_customer_id: subscription.customer as string,
    stripe_subscription_id: null,
    stripe_price_id: null,
    status: 'canceled' as const,
    trial_end: null
  };

  await entitlementsService.updateEntitlements(orgId, entitlementUpdates);

  await entitlementsService.logBillingEvent(
    orgId,
    'subscription_canceled',
    { subscription_id: subscription.id, downgraded_to: 'free' },
    event.id
  );
}

async function handlePaymentSucceeded(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  
  if (!invoice.subscription) return;

  const orgId = await mapCustomerToOrg(invoice.customer as string);
  if (!orgId) return;

  await entitlementsService.logBillingEvent(
    orgId,
    'payment_succeeded',
    {
      invoice_id: invoice.id,
      subscription_id: invoice.subscription,
      amount_paid: invoice.amount_paid
    },
    event.id
  );

  const entitlements = await entitlementsService.getEntitlements(orgId);
  if (entitlements?.status === 'past_due') {
    await entitlementsService.updateEntitlements(orgId, { status: 'active' });
  }
}

async function handlePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  
  if (!invoice.subscription) return;

  const orgId = await mapCustomerToOrg(invoice.customer as string);
  if (!orgId) return;

  await entitlementsService.updateEntitlements(orgId, { status: 'past_due' });

  await entitlementsService.logBillingEvent(
    orgId,
    'payment_failed',
    { invoice_id: invoice.id, amount_due: invoice.amount_due },
    event.id
  );
}

async function handleTrialWillEnd(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  
  const orgId = await mapCustomerToOrg(subscription.customer as string);
  if (!orgId) return;

  await entitlementsService.logBillingEvent(
    orgId,
    'trial_will_end',
    { subscription_id: subscription.id },
    event.id
  );
}

async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  
  if (session.mode !== 'subscription') return;

  const orgId = session.metadata?.org_id;
  if (!orgId) return;

  await entitlementsService.logBillingEvent(
    orgId,
    'checkout_completed',
    {
      session_id: session.id,
      subscription_id: session.subscription,
      tier: session.metadata?.tier
    },
    event.id
  );
}

async function mapCustomerToOrg(customerId: string): Promise<string | null> {
  const supabase = createSupabaseClient();
  
  const { data, error } = await supabase
    .from('org_entitlements')
    .select('org_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (error || !data) {
    console.error('Error mapping customer to org:', error);
    return null;
  }

  return data.org_id;
}