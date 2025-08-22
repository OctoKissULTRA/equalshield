-- Migration: Entitlements and Billing Tables
-- Created: 2024-08-22
-- Description: Add tables for subscription entitlements, usage tracking, and Stripe integration

-- Stripe products mapping
CREATE TABLE IF NOT EXISTS stripe_products (
  tier text PRIMARY KEY CHECK (tier IN ('starter','pro','enterprise')),
  product_id text NOT NULL,
  price_monthly text NOT NULL,
  price_yearly text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Organization entitlements (subscription benefits)
CREATE TABLE IF NOT EXISTS org_entitlements (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('free','starter','pro','enterprise')),
  pages_per_scan int NOT NULL CHECK (pages_per_scan > 0),
  scans_per_month int NOT NULL CHECK (scans_per_month > 0),
  features jsonb NOT NULL DEFAULT '{}',
  
  -- Subscription period (for paid tiers)
  period_start timestamptz,
  period_end timestamptz,
  
  -- Stripe integration
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  
  -- Status tracking
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','canceled','past_due','incomplete','trialing')),
  trial_end timestamptz,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_paid_subscription CHECK (
    (tier = 'free' AND stripe_customer_id IS NULL) OR
    (tier != 'free' AND stripe_customer_id IS NOT NULL)
  ),
  
  CONSTRAINT valid_subscription_period CHECK (
    (tier = 'free' AND period_start IS NULL AND period_end IS NULL) OR
    (tier != 'free' AND period_start IS NOT NULL AND period_end IS NOT NULL AND period_end > period_start)
  )
);

-- Usage tracking per billing period
CREATE TABLE IF NOT EXISTS scan_usage (
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  scans_used int NOT NULL DEFAULT 0 CHECK (scans_used >= 0),
  pages_used int NOT NULL DEFAULT 0 CHECK (pages_used >= 0),
  last_reset timestamptz NOT NULL DEFAULT now(),
  
  PRIMARY KEY (org_id, period_start),
  
  -- Foreign key to entitlements
  CONSTRAINT fk_usage_entitlements FOREIGN KEY (org_id) REFERENCES org_entitlements(org_id)
);

-- Billing events log (for audit and debugging)
CREATE TABLE IF NOT EXISTS billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}',
  stripe_event_id text,
  processed_at timestamptz NOT NULL DEFAULT now(),
  
  -- Indexes for common queries
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_entitlements_tier ON org_entitlements(tier);
CREATE INDEX IF NOT EXISTS idx_org_entitlements_status ON org_entitlements(status);
CREATE INDEX IF NOT EXISTS idx_org_entitlements_stripe_customer ON org_entitlements(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_org_entitlements_period ON org_entitlements(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_scan_usage_period ON scan_usage(period_start);
CREATE INDEX IF NOT EXISTS idx_scan_usage_org_period ON scan_usage(org_id, period_start);

CREATE INDEX IF NOT EXISTS idx_billing_events_org ON billing_events(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_type ON billing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_events_created ON billing_events(created_at);
CREATE INDEX IF NOT EXISTS idx_billing_events_stripe ON billing_events(stripe_event_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stripe_products_updated_at 
  BEFORE UPDATE ON stripe_products 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_entitlements_updated_at 
  BEFORE UPDATE ON org_entitlements 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Default entitlements for free tier
-- This will be handled by the application code during org creation

-- Seed default Stripe products (will be populated by seed script)
-- INSERT INTO stripe_products (tier, product_id, price_monthly, price_yearly) VALUES ...

-- Sample data for development (uncomment if needed)
/*
INSERT INTO org_entitlements (org_id, tier, pages_per_scan, scans_per_month, features) 
SELECT 
  id,
  'free',
  3,
  3,
  '{"pdf": false, "vpat": false, "api": false, "share_links": false, "watermark": true, "support": "community"}'::jsonb
FROM organizations 
WHERE NOT EXISTS (SELECT 1 FROM org_entitlements WHERE org_entitlements.org_id = organizations.id);
*/

-- Views for common queries
CREATE OR REPLACE VIEW current_entitlements AS
SELECT 
  oe.*,
  o.name as org_name,
  o.slug as org_slug,
  CASE 
    WHEN oe.tier = 'free' THEN true
    WHEN oe.period_end IS NULL THEN false
    WHEN oe.period_end > now() THEN true
    ELSE false
  END as is_active,
  CASE
    WHEN oe.tier = 'free' THEN null
    WHEN oe.period_end IS NULL THEN null
    ELSE extract(days from (oe.period_end - now()))
  END as days_remaining
FROM org_entitlements oe
JOIN organizations o ON oe.org_id = o.id;

CREATE OR REPLACE VIEW usage_summary AS
SELECT 
  su.*,
  oe.tier,
  oe.scans_per_month as scan_limit,
  oe.pages_per_scan as page_limit,
  ROUND((su.scans_used::float / oe.scans_per_month::float) * 100, 2) as scan_usage_percent,
  CASE 
    WHEN su.scans_used >= oe.scans_per_month THEN true
    ELSE false
  END as scan_limit_exceeded,
  -- Calculate period end
  CASE 
    WHEN oe.tier = 'free' THEN date_trunc('month', su.period_start) + interval '1 month'
    ELSE oe.period_end
  END as period_end
FROM scan_usage su
JOIN org_entitlements oe ON su.org_id = oe.org_id;

-- Function to get current billing period for an org
CREATE OR REPLACE FUNCTION get_current_period(p_org_id uuid)
RETURNS TABLE(period_start timestamptz, period_end timestamptz) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN oe.tier = 'free' THEN date_trunc('month', now())
      ELSE oe.period_start
    END as period_start,
    CASE 
      WHEN oe.tier = 'free' THEN date_trunc('month', now()) + interval '1 month'
      ELSE oe.period_end
    END as period_end
  FROM org_entitlements oe
  WHERE oe.org_id = p_org_id;
END;
$$ LANGUAGE plpgsql;

-- Function to initialize usage record for current period
CREATE OR REPLACE FUNCTION ensure_usage_record(p_org_id uuid)
RETURNS void AS $$
DECLARE
  current_period timestamptz;
BEGIN
  -- Get current period start
  SELECT period_start INTO current_period 
  FROM get_current_period(p_org_id) 
  LIMIT 1;
  
  -- Insert usage record if it doesn't exist
  INSERT INTO scan_usage (org_id, period_start, scans_used, pages_used)
  VALUES (p_org_id, current_period, 0, 0)
  ON CONFLICT (org_id, period_start) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function to increment usage atomically
CREATE OR REPLACE FUNCTION increment_usage(
  p_org_id uuid,
  p_scans_increment int DEFAULT 1,
  p_pages_increment int DEFAULT 0
)
RETURNS TABLE(scans_used int, pages_used int, scans_remaining int) AS $$
DECLARE
  current_period timestamptz;
  scan_limit int;
  result_scans int;
  result_pages int;
  remaining int;
BEGIN
  -- Get current period and ensure usage record exists
  PERFORM ensure_usage_record(p_org_id);
  SELECT period_start INTO current_period FROM get_current_period(p_org_id) LIMIT 1;
  SELECT scans_per_month INTO scan_limit FROM org_entitlements WHERE org_id = p_org_id;
  
  -- Atomically increment usage
  UPDATE scan_usage 
  SET 
    scans_used = scans_used + p_scans_increment,
    pages_used = pages_used + p_pages_increment,
    last_reset = now()
  WHERE org_id = p_org_id AND period_start = current_period
  RETURNING scan_usage.scans_used, scan_usage.pages_used INTO result_scans, result_pages;
  
  -- Calculate remaining
  remaining = GREATEST(0, scan_limit - result_scans);
  
  RETURN QUERY SELECT result_scans, result_pages, remaining;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE org_entitlements IS 'Organization subscription entitlements and limits';
COMMENT ON TABLE scan_usage IS 'Usage tracking per organization per billing period';
COMMENT ON TABLE billing_events IS 'Audit log of billing-related events from Stripe webhooks';
COMMENT ON TABLE stripe_products IS 'Mapping of subscription tiers to Stripe product/price IDs';

COMMENT ON COLUMN org_entitlements.features IS 'JSON object containing feature flags for the subscription tier';
COMMENT ON COLUMN org_entitlements.status IS 'Subscription status from Stripe (active, canceled, past_due, etc.)';
COMMENT ON COLUMN scan_usage.period_start IS 'Start of billing period (month start for free tier, subscription period for paid)';

-- Grant permissions (adjust based on your database setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON org_entitlements TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON scan_usage TO app_user;
-- GRANT SELECT, INSERT ON billing_events TO app_user;
-- GRANT SELECT ON stripe_products TO app_user;