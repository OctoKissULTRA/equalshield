'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  CreditCard, 
  ExternalLink,
  Zap,
  Star,
  Building,
  TrendingUp
} from 'lucide-react';
import { formatCurrency, TIER_CONFIGS, type Tier } from '@/lib/billing/stripe';
import ShareManager from '@/components/reports/ShareManager';

interface EntitlementData {
  tier: Tier;
  pages_per_scan: number;
  scans_per_month: number;
  features: Record<string, any>;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';
  period_start?: string;
  period_end?: string;
  stripe_customer_id?: string;
}

interface UsageData {
  scans_used: number;
  pages_used: number;
  scan_limit: number;
  scan_usage_percent: number;
  period_end: string;
}

export default function BillingPage() {
  const [entitlements, setEntitlements] = useState<EntitlementData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      // TODO: Replace with actual API calls to fetch entitlements and usage
      // For now, using mock data
      const mockEntitlements: EntitlementData = {
        tier: 'free',
        pages_per_scan: 3,
        scans_per_month: 3,
        features: TIER_CONFIGS.free.features,
        status: 'active'
      };
      
      const mockUsage: UsageData = {
        scans_used: 2,
        pages_used: 6,
        scan_limit: 3,
        scan_usage_percent: 67,
        period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      setEntitlements(mockEntitlements);
      setUsage(mockUsage);
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tier: 'starter' | 'pro' | 'enterprise', interval: 'monthly' | 'yearly') => {
    setUpgrading(tier);
    
    try {
      const response = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, interval })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Upgrade failed:', error);
      alert('Failed to start upgrade process. Please try again.');
    } finally {
      setUpgrading(null);
    }
  };

  const handlePortal = async () => {
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const { url } = await response.json();
      window.open(url, '_blank');
    } catch (error) {
      console.error('Portal access failed:', error);
      alert('Failed to access billing portal. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-48 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const getTierIcon = (tier: Tier) => {
    switch (tier) {
      case 'starter': return <Zap className="h-5 w-5" />;
      case 'pro': return <Star className="h-5 w-5" />;
      case 'enterprise': return <Building className="h-5 w-5" />;
      default: return <CheckCircle className="h-5 w-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trialing': return 'bg-blue-100 text-blue-800';
      case 'past_due': return 'bg-red-100 text-red-800';
      case 'canceled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-gray-600 mt-2">
          Manage your EqualShield subscription and usage
        </p>
      </div>

      {/* Current Plan */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getTierIcon(entitlements?.tier || 'free')}
              Current Plan: {entitlements?.tier?.charAt(0).toUpperCase() + entitlements?.tier?.slice(1) || 'Free'}
            </CardTitle>
            <CardDescription>
              <Badge className={getStatusColor(entitlements?.status || 'active')}>
                {entitlements?.status || 'Active'}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Scans per month</p>
                <p className="text-xl font-semibold">{entitlements?.scans_per_month || 0}</p>
              </div>
              <div>
                <p className="text-gray-600">Pages per scan</p>
                <p className="text-xl font-semibold">{entitlements?.pages_per_scan || 0}</p>
              </div>
            </div>
            
            {entitlements?.features && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Features</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    {entitlements.features.pdf ? <CheckCircle className="h-3 w-3 text-green-600" /> : <XCircle className="h-3 w-3 text-gray-400" />}
                    PDF Reports
                  </div>
                  <div className="flex items-center gap-1">
                    {entitlements.features.vpat ? <CheckCircle className="h-3 w-3 text-green-600" /> : <XCircle className="h-3 w-3 text-gray-400" />}
                    VPAT Export
                  </div>
                  <div className="flex items-center gap-1">
                    {entitlements.features.api ? <CheckCircle className="h-3 w-3 text-green-600" /> : <XCircle className="h-3 w-3 text-gray-400" />}
                    API Access
                  </div>
                  <div className="flex items-center gap-1">
                    {!entitlements.features.watermark ? <CheckCircle className="h-3 w-3 text-green-600" /> : <XCircle className="h-3 w-3 text-gray-400" />}
                    No Watermark
                  </div>
                </div>
              </div>
            )}

            {entitlements?.stripe_customer_id && (
              <Button 
                onClick={handlePortal} 
                variant="outline" 
                className="w-full"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Manage Billing
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Current Usage
            </CardTitle>
            <CardDescription>
              Period ends {usage ? new Date(usage.period_end).toLocaleDateString() : 'N/A'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Scans used</span>
                <span>{usage?.scans_used || 0} / {usage?.scan_limit || 0}</span>
              </div>
              <Progress value={usage?.scan_usage_percent || 0} className="h-2" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Total pages scanned</p>
                <p className="text-xl font-semibold">{usage?.pages_used || 0}</p>
              </div>
              <div>
                <p className="text-gray-600">Remaining scans</p>
                <p className="text-xl font-semibold">{(usage?.scan_limit || 0) - (usage?.scans_used || 0)}</p>
              </div>
            </div>

            {usage && usage.scan_usage_percent > 80 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <Clock className="h-4 w-4 inline mr-1" />
                  You've used {Math.round(usage.scan_usage_percent)}% of your monthly scans
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upgrade Options */}
      {entitlements?.tier === 'free' && (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade Your Plan</CardTitle>
            <CardDescription>
              Get more scans, advanced features, and priority support
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Starter Plan */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold">Starter</h3>
                </div>
                <p className="text-2xl font-bold mb-1">{formatCurrency(2900)}</p>
                <p className="text-sm text-gray-600 mb-4">per month</p>
                <ul className="text-sm space-y-1 mb-4">
                  <li>✓ 10 scans/month</li>
                  <li>✓ 5 pages/scan</li>
                  <li>✓ Share report links</li>
                  <li>✓ Email support</li>
                </ul>
                <Button 
                  onClick={() => handleUpgrade('starter', 'monthly')}
                  disabled={upgrading === 'starter'}
                  className="w-full"
                >
                  {upgrading === 'starter' ? 'Processing...' : 'Upgrade to Starter'}
                </Button>
              </div>

              {/* Pro Plan */}
              <div className="p-4 border-2 border-blue-500 rounded-lg relative">
                <Badge className="absolute -top-2 left-4 bg-blue-500">Most Popular</Badge>
                <div className="flex items-center gap-2 mb-2">
                  <Star className="h-5 w-5 text-yellow-600" />
                  <h3 className="font-semibold">Pro</h3>
                </div>
                <p className="text-2xl font-bold mb-1">{formatCurrency(9900)}</p>
                <p className="text-sm text-gray-600 mb-4">per month</p>
                <ul className="text-sm space-y-1 mb-4">
                  <li>✓ 100 scans/month</li>
                  <li>✓ 50 pages/scan</li>
                  <li>✓ PDF & VPAT exports</li>
                  <li>✓ API access</li>
                  <li>✓ Priority support</li>
                </ul>
                <Button 
                  onClick={() => handleUpgrade('pro', 'monthly')}
                  disabled={upgrading === 'pro'}
                  className="w-full"
                >
                  {upgrading === 'pro' ? 'Processing...' : 'Upgrade to Pro'}
                </Button>
              </div>

              {/* Enterprise Plan */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Building className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold">Enterprise</h3>
                </div>
                <p className="text-2xl font-bold mb-1">{formatCurrency(49900)}</p>
                <p className="text-sm text-gray-600 mb-4">per month</p>
                <ul className="text-sm space-y-1 mb-4">
                  <li>✓ 1000 scans/month</li>
                  <li>✓ 500 pages/scan</li>
                  <li>✓ SSO integration</li>
                  <li>✓ Custom branding</li>
                  <li>✓ Dedicated support</li>
                </ul>
                <Button 
                  onClick={() => handleUpgrade('enterprise', 'monthly')}
                  disabled={upgrading === 'enterprise'}
                  variant="outline"
                  className="w-full"
                >
                  {upgrading === 'enterprise' ? 'Processing...' : 'Upgrade to Enterprise'}
                </Button>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 <strong>Save 17%</strong> with annual billing. Switch to yearly plans in the checkout.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}