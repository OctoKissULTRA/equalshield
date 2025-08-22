import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import { createPortalSession } from '@/lib/billing/stripe';
import { entitlementsService } from '@/lib/entitlements';

export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const user = await requireUser();
    
    // TODO: Check if user is organization owner/admin
    // For now, we'll allow all authenticated users
    
    // TODO: Get user's organization - this would come from your auth system
    const orgId = user.orgId || 'sample-org-id'; // Replace with actual org lookup
    
    // Get organization entitlements to find Stripe customer ID
    const entitlements = await entitlementsService.getEntitlements(orgId);
    
    if (!entitlements || !entitlements.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found for this organization' },
        { status: 404 }
      );
    }

    // Create customer portal session
    const portalSession = await createPortalSession(
      entitlements.stripe_customer_id,
      `${process.env.NEXT_PUBLIC_APP_URL}/billing`
    );

    // Log portal access
    await entitlementsService.logBillingEvent(
      orgId,
      'portal_accessed',
      {
        customer_id: entitlements.stripe_customer_id,
        portal_session_id: portalSession.id
      }
    );

    return NextResponse.json({
      url: portalSession.url
    });

  } catch (error) {
    console.error('Portal creation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create portal session',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}