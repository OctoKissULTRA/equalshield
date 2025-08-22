/**
 * Entitlements and Usage Management
 * 
 * Handles subscription entitlements, usage tracking, and enforcement
 */

import { createSupabaseClient } from '@/lib/supabase/server';
import { TIER_CONFIGS, type Tier } from '@/lib/billing/stripe';

export interface OrgEntitlements {
  org_id: string;
  tier: Tier;
  pages_per_scan: number;
  scans_per_month: number;
  features: Record<string, any>;
  period_start?: string;
  period_end?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  stripe_price_id?: string;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';
  trial_end?: string;
  created_at: string;
  updated_at: string;
}

export interface UsageInfo {
  org_id: string;
  period_start: string;
  scans_used: number;
  pages_used: number;
  last_reset: string;
  scan_limit: number;
  page_limit: number;
  scan_usage_percent: number;
  scan_limit_exceeded: boolean;
  period_end: string;
}

export interface UsageLimits {
  canScan: boolean;
  scansRemaining: number;
  pagesPerScan: number;
  reasonCode?: 'scan_limit_exceeded' | 'subscription_expired' | 'subscription_inactive';
  upgradeUrl?: string;
}

export class EntitlementsService {
  private supabase = createSupabaseClient();

  // Get entitlements for an organization
  async getEntitlements(orgId: string): Promise<OrgEntitlements | null> {
    const { data, error } = await this.supabase
      .from('org_entitlements')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (error) {
      console.error('Error fetching entitlements:', error);
      return null;
    }

    return data;
  }

  // Get current usage for an organization
  async getUsage(orgId: string): Promise<UsageInfo | null> {
    const { data, error } = await this.supabase
      .from('usage_summary')
      .select('*')
      .eq('org_id', orgId)
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching usage:', error);
      return null;
    }

    return data;
  }

  // Check if organization can perform a scan
  async checkScanLimits(orgId: string, requestedPages?: number): Promise<UsageLimits> {
    const entitlements = await this.getEntitlements(orgId);
    
    if (!entitlements) {
      // No entitlements found, default to free tier limits
      return {
        canScan: false,
        scansRemaining: 0,
        pagesPerScan: TIER_CONFIGS.free.pages_per_scan,
        reasonCode: 'subscription_inactive',
        upgradeUrl: '/billing'
      };
    }

    // Check subscription status
    if (entitlements.status !== 'active' && entitlements.tier !== 'free') {
      return {
        canScan: false,
        scansRemaining: 0,
        pagesPerScan: entitlements.pages_per_scan,
        reasonCode: 'subscription_inactive',
        upgradeUrl: '/billing'
      };
    }

    // Check if subscription has expired
    if (entitlements.period_end && new Date(entitlements.period_end) < new Date()) {
      return {
        canScan: false,
        scansRemaining: 0,
        pagesPerScan: entitlements.pages_per_scan,
        reasonCode: 'subscription_expired',
        upgradeUrl: '/billing'
      };
    }

    // Get current usage
    const usage = await this.getUsage(orgId);
    
    if (!usage) {
      // No usage record, initialize one
      await this.ensureUsageRecord(orgId);
      
      return {
        canScan: true,
        scansRemaining: entitlements.scans_per_month,
        pagesPerScan: Math.min(
          requestedPages || entitlements.pages_per_scan,
          entitlements.pages_per_scan
        )
      };
    }

    // Check scan limits
    const scansRemaining = Math.max(0, entitlements.scans_per_month - usage.scans_used);
    
    if (scansRemaining <= 0) {
      return {
        canScan: false,
        scansRemaining: 0,
        pagesPerScan: entitlements.pages_per_scan,
        reasonCode: 'scan_limit_exceeded',
        upgradeUrl: '/billing'
      };
    }

    return {
      canScan: true,
      scansRemaining,
      pagesPerScan: Math.min(
        requestedPages || entitlements.pages_per_scan,
        entitlements.pages_per_scan
      )
    };
  }

  // Create default entitlements for a new organization
  async createDefaultEntitlements(orgId: string): Promise<OrgEntitlements> {
    const defaultConfig = TIER_CONFIGS.free;
    
    const { data, error } = await this.supabase
      .from('org_entitlements')
      .insert({
        org_id: orgId,
        tier: 'free',
        pages_per_scan: defaultConfig.pages_per_scan,
        scans_per_month: defaultConfig.scans_per_month,
        features: defaultConfig.features,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating default entitlements:', error);
      throw new Error('Failed to create default entitlements');
    }

    // Initialize usage record
    await this.ensureUsageRecord(orgId);

    return data;
  }

  // Update entitlements (typically called from webhook)
  async updateEntitlements(
    orgId: string,
    updates: Partial<OrgEntitlements>
  ): Promise<OrgEntitlements> {
    const { data, error } = await this.supabase
      .from('org_entitlements')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) {
      console.error('Error updating entitlements:', error);
      throw new Error('Failed to update entitlements');
    }

    return data;
  }

  // Ensure usage record exists for current period
  private async ensureUsageRecord(orgId: string): Promise<void> {
    try {
      await this.supabase.rpc('ensure_usage_record', { p_org_id: orgId });
    } catch (error) {
      console.error('Error ensuring usage record:', error);
    }
  }

  // Increment usage atomically
  async incrementUsage(
    orgId: string,
    scansIncrement: number = 1,
    pagesIncrement: number = 0
  ): Promise<{ scans_used: number; pages_used: number; scans_remaining: number }> {
    const { data, error } = await this.supabase.rpc('increment_usage', {
      p_org_id: orgId,
      p_scans_increment: scansIncrement,
      p_pages_increment: pagesIncrement
    });

    if (error) {
      console.error('Error incrementing usage:', error);
      throw new Error('Failed to increment usage');
    }

    return data[0];
  }

  // Check if organization has access to a feature
  async hasFeature(orgId: string, feature: string): Promise<boolean> {
    const entitlements = await this.getEntitlements(orgId);
    
    if (!entitlements) {
      return false;
    }

    return entitlements.features[feature] === true;
  }

  // Get feature flags for an organization
  async getFeatures(orgId: string): Promise<Record<string, any>> {
    const entitlements = await this.getEntitlements(orgId);
    
    if (!entitlements) {
      return TIER_CONFIGS.free.features;
    }

    return entitlements.features;
  }

  // Get upgrade recommendations
  async getUpgradeRecommendations(orgId: string): Promise<{
    currentTier: Tier;
    suggestedTier?: Tier;
    reasons: string[];
    benefits: string[];
  }> {
    const entitlements = await this.getEntitlements(orgId);
    const usage = await this.getUsage(orgId);
    
    if (!entitlements) {
      return {
        currentTier: 'free',
        suggestedTier: 'starter',
        reasons: ['No active subscription'],
        benefits: ['Higher scan limits', 'Remove watermarks', 'Email support']
      };
    }

    const currentTier = entitlements.tier;
    const reasons: string[] = [];
    const benefits: string[] = [];
    
    // Analyze usage patterns
    if (usage && usage.scan_usage_percent > 80) {
      reasons.push(`Using ${Math.round(usage.scan_usage_percent)}% of scan limit`);
    }
    
    if (usage && usage.scan_limit_exceeded) {
      reasons.push('Scan limit exceeded this period');
    }

    // Suggest upgrade path
    let suggestedTier: Tier | undefined;
    
    if (currentTier === 'free') {
      suggestedTier = 'starter';
      benefits.push('Remove EqualShield watermark', 'Share reports with links', 'Email support');
    } else if (currentTier === 'starter') {
      suggestedTier = 'pro';
      benefits.push('PDF & VPAT exports', 'API access', '10x more scans', 'Priority support');
    } else if (currentTier === 'pro') {
      suggestedTier = 'enterprise';
      benefits.push('Unlimited scanning', 'SSO integration', 'Custom branding', 'Dedicated support');
    }

    return {
      currentTier,
      suggestedTier,
      reasons,
      benefits
    };
  }

  // Log billing events for audit trail
  async logBillingEvent(
    orgId: string | null,
    eventType: string,
    eventData: Record<string, any>,
    stripeEventId?: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('billing_events')
        .insert({
          org_id: orgId,
          event_type: eventType,
          event_data: eventData,
          stripe_event_id: stripeEventId
        });
    } catch (error) {
      console.error('Error logging billing event:', error);
    }
  }

  // Get billing events for organization (for debugging/support)
  async getBillingEvents(
    orgId: string,
    limit: number = 50
  ): Promise<Array<{
    id: string;
    event_type: string;
    event_data: Record<string, any>;
    stripe_event_id?: string;
    created_at: string;
  }>> {
    const { data, error } = await this.supabase
      .from('billing_events')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching billing events:', error);
      return [];
    }

    return data || [];
  }

  // Reset usage for testing/admin purposes
  async resetUsage(orgId: string): Promise<void> {
    const { error } = await this.supabase
      .from('scan_usage')
      .update({
        scans_used: 0,
        pages_used: 0,
        last_reset: new Date().toISOString()
      })
      .eq('org_id', orgId);

    if (error) {
      console.error('Error resetting usage:', error);
      throw new Error('Failed to reset usage');
    }

    await this.logBillingEvent(orgId, 'usage_reset', {
      reset_by: 'admin',
      reset_at: new Date().toISOString()
    });
  }
}

// Singleton instance
export const entitlementsService = new EntitlementsService();

// Convenience functions
export async function getEntitlements(orgId: string): Promise<OrgEntitlements | null> {
  return entitlementsService.getEntitlements(orgId);
}

export async function getCurrentUsage(orgId: string): Promise<UsageInfo | null> {
  return entitlementsService.getUsage(orgId);
}

export async function checkScanLimits(orgId: string, requestedPages?: number): Promise<UsageLimits> {
  return entitlementsService.checkScanLimits(orgId, requestedPages);
}

export async function incrementUsage(
  orgId: string,
  scansIncrement: number = 1,
  pagesIncrement: number = 0
): Promise<{ scans_used: number; pages_used: number; scans_remaining: number }> {
  return entitlementsService.incrementUsage(orgId, scansIncrement, pagesIncrement);
}

export async function hasFeature(orgId: string, feature: string): Promise<boolean> {
  return entitlementsService.hasFeature(orgId, feature);
}

export async function getFeatures(orgId: string): Promise<Record<string, any>> {
  return entitlementsService.getFeatures(orgId);
}