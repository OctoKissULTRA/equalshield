export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getTrialSession, migrateTrialToOrg, getTrialCookieId } from '@/lib/trial';
import { entitlementsService } from '@/lib/entitlements';

/**
 * POST /api/trial/upgrade
 * 
 * Migrate trial data to a new paid organization after user signup
 */
export async function POST(req: NextRequest) {
  try {
    const { userEmail, newOrgId } = await req.json();

    // Validate required fields
    if (!userEmail || !newOrgId) {
      return NextResponse.json(
        { error: 'User email and organization ID are required' },
        { status: 400 }
      );
    }

    // Get trial cookie
    const cookieHeader = req.headers.get('cookie');
    const cookieId = getTrialCookieId(cookieHeader);

    if (!cookieId) {
      return NextResponse.json(
        { error: 'No trial session found' },
        { status: 400 }
      );
    }

    // Get trial session and org
    const trialData = await getTrialSession(cookieId);
    if (!trialData) {
      return NextResponse.json(
        { error: 'Trial session expired or not found' },
        { status: 404 }
      );
    }

    const { session, trialOrg } = trialData;

    // Check if trial has already been upgraded
    if (trialOrg.upgraded_at) {
      return NextResponse.json(
        { error: 'Trial has already been upgraded' },
        { status: 400 }
      );
    }

    // Migrate trial data to the new organization
    const migrationResult = await migrateTrialToOrg(trialOrg.id, newOrgId);
    
    if (!migrationResult.success) {
      console.error('Trial migration failed:', migrationResult.error);
      return NextResponse.json(
        { error: 'Failed to migrate trial data' },
        { status: 500 }
      );
    }

    // Log the upgrade event
    try {
      await entitlementsService.logBillingEvent(
        newOrgId,
        'trial.upgraded',
        {
          trial_org_id: trialOrg.id,
          trial_domain: trialOrg.domain,
          trial_created_at: trialOrg.created_at,
          completed_scans: trialOrg.completed_scans,
          user_email: userEmail,
          migration_timestamp: new Date().toISOString()
        }
      );
    } catch (logError) {
      console.error('Failed to log trial upgrade:', logError);
      // Don't fail the upgrade for logging errors
    }

    // Clear the trial cookie by setting it to expire
    const clearCookieHeader = `equalshield_trial=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

    return NextResponse.json({
      success: true,
      message: 'Trial data migrated successfully',
      orgId: newOrgId,
      migratedScans: trialOrg.completed_scans,
      trialDomain: trialOrg.domain
    }, {
      headers: {
        'Set-Cookie': clearCookieHeader
      }
    });

  } catch (error) {
    console.error('Trial upgrade error:', error);
    return NextResponse.json(
      { error: 'Failed to upgrade trial' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trial/upgrade
 * 
 * Get current trial status for upgrade preparation
 */
export async function GET(req: NextRequest) {
  try {
    // Get trial cookie
    const cookieHeader = req.headers.get('cookie');
    const cookieId = getTrialCookieId(cookieHeader);

    if (!cookieId) {
      return NextResponse.json(
        { error: 'No trial session found' },
        { status: 404 }
      );
    }

    // Get trial session and org
    const trialData = await getTrialSession(cookieId);
    if (!trialData) {
      return NextResponse.json(
        { error: 'Trial session expired or not found' },
        { status: 404 }
      );
    }

    const { session, trialOrg } = trialData;

    return NextResponse.json({
      success: true,
      trial: {
        id: trialOrg.id,
        domain: trialOrg.domain,
        completedScans: trialOrg.completed_scans,
        scansRemaining: trialOrg.scans_remaining,
        createdAt: trialOrg.created_at,
        expiresAt: trialOrg.expires_at,
        upgradedAt: trialOrg.upgraded_at,
        canUpgrade: !trialOrg.upgraded_at && trialOrg.completed_scans > 0
      },
      session: {
        id: session.id,
        createdAt: session.created_at,
        expiresAt: session.expires_at
      }
    });

  } catch (error) {
    console.error('Trial status error:', error);
    return NextResponse.json(
      { error: 'Failed to get trial status' },
      { status: 500 }
    );
  }
}