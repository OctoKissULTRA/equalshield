import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import { createOrGetCustomer, createCheckoutSession, getPriceId, type TierName, type BillingInterval } from '@/lib/billing/stripe';
import { entitlementsService } from '@/lib/entitlements';

export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const user = await requireUser();
    
    const body = await req.json();
    const { tier, interval = 'monthly' } = body;
    
    // Validate input
    if (!tier || !['starter', 'pro', 'enterprise'].includes(tier)) {
      return NextResponse.json(
        { error: 'Valid tier required (starter, pro, enterprise)' },
        { status: 400 }
      );
    }
    
    if (!interval || !['monthly', 'yearly'].includes(interval)) {
      return NextResponse.json(
        { error: 'Valid interval required (monthly, yearly)' },
        { status: 400 }
      );
    }

    // TODO: Get user's organization - this would come from your auth system
    const orgId = user.orgId || 'sample-org-id'; // Replace with actual org lookup
    const orgName = user.orgName || 'Sample Organization';
    const userEmail = user.email || 'user@example.com';

    // Check if user already has a subscription
    const existingEntitlements = await entitlementsService.getEntitlements(orgId);
    if (existingEntitlements && existingEntitlements.tier !== 'free' && existingEntitlements.status === 'active') {
      return NextResponse.json(
        { error: 'Organization already has an active subscription' },
        { status: 400 }
      );
    }

    // Create or get Stripe customer
    const customer = await createOrGetCustomer(userEmail, orgId, orgName);
    
    // Get the price ID for the selected tier and interval
    const priceId = getPriceId(tier as TierName, interval as BillingInterval);
    
    // Create checkout session
    const session = await createCheckoutSession({
      customerId: customer.id,
      priceId,
      orgId,
      tier: tier as TierName,
      interval: interval as BillingInterval,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?sub=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing?sub=canceled`
    });

    // Log the checkout attempt
    await entitlementsService.logBillingEvent(
      orgId,
      'checkout_initiated',
      {
        tier,
        interval,
        price_id: priceId,
        session_id: session.id,
        customer_id: customer.id
      }
    );

    return NextResponse.json({
      url: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('Subscription creation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create subscription',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}