-- EqualShield Database Setup
-- Run this in Supabase SQL Editor

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists uuid-ossp;

-- PRICING TIERS: free, starter($49), professional($149), enterprise($399)

-- Organizations table (separate from teams for simplicity)
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  email varchar(255) unique not null,
  company_name varchar(255),
  domain varchar(255),
  subscription_tier varchar(50) default 'free' check (subscription_tier in ('free','starter','professional','enterprise')),
  page_views_used int default 0,
  page_views_limit int default 100,
  stripe_customer_id varchar(255),
  trial_ends_at timestamp default (now() + interval '14 days'),
  created_at timestamp default now()
);

-- Scans table
create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  url text not null,
  domain varchar(255),
  pages_scanned int default 1,
  scan_depth varchar(50) default 'standard',
  wcag_score int,
  ada_risk_score int,
  lawsuit_probability numeric(5,2),
  total_violations int default 0,
  critical_violations int default 0,
  serious_violations int default 0,
  moderate_violations int default 0,
  minor_violations int default 0,
  violations jsonb,
  ai_analysis jsonb,
  recommendations jsonb,
  legal_assessment jsonb,
  status varchar(50) default 'pending',
  error_message text,
  processing_time_ms int,
  created_at timestamp default now(),
  completed_at timestamp
);

-- Violations table
create table if not exists violations (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid references scans(id) on delete cascade,
  wcag_criterion varchar(20) not null,
  wcag_version varchar(10) default '2.1',
  conformance_level varchar(3) default 'AA',
  severity varchar(20) not null,
  element_type varchar(50),
  element_selector text,
  element_html text,
  page_url text,
  user_impact text not null,
  business_impact text,
  legal_risk_level varchar(20),
  lawsuit_cases jsonb,
  fix_description text not null,
  fix_code text,
  fix_effort varchar(20),
  estimated_fix_time varchar(50),
  status varchar(50) default 'open',
  ai_confidence numeric(3,2),
  false_positive boolean default false,
  created_at timestamp default now()
);

-- Indexes for performance
create index if not exists idx_scans_org on scans(organization_id);
create index if not exists idx_scans_status on scans(status);
create index if not exists idx_violations_scan on violations(scan_id);
create index if not exists idx_violations_severity on violations(severity);
create index if not exists idx_organizations_email on organizations(email);

-- Row Level Security: Enable
alter table organizations enable row level security;
alter table scans enable row level security;
alter table violations enable row level security;

-- MVP Policies (permissive for now, tighten later)

-- Organizations: allow insert by anyone (email-only flow)
drop policy if exists "org_insert_any" on organizations;
create policy "org_insert_any" on organizations
for insert with check (true);

-- Organizations: allow select by email match
drop policy if exists "org_select_by_email" on organizations;
create policy "org_select_by_email" on organizations
for select using (email = current_setting('request.jwt.claims')::json->>'email');

-- Organizations: allow select by anyone for MVP (will tighten)
drop policy if exists "org_select_all_mvp" on organizations;
create policy "org_select_all_mvp" on organizations
for select using (true);

-- Scans: allow read by anyone for public results page (MVP)
drop policy if exists "scan_read_all" on scans;
create policy "scan_read_all" on scans
for select using (true);

-- Scans: allow writes from service role
drop policy if exists "scan_write_service" on scans;
create policy "scan_write_service" on scans
for insert with check (true);

drop policy if exists "scan_update_service" on scans;
create policy "scan_update_service" on scans
for update using (true);

-- Violations: allow writes from service role
drop policy if exists "violations_write_service" on violations;
create policy "violations_write_service" on violations
for insert with check (true);

-- Violations: allow read by anyone (MVP)
drop policy if exists "violations_read_all" on violations;
create policy "violations_read_all" on violations
for select using (true);

-- RPC function for usage tracking
create or replace function increment_page_views(org_id uuid, amount int)
returns void language sql security definer as $$
  update organizations
     set page_views_used = coalesce(page_views_used,0) + greatest(amount,0)
   where id = org_id;
$$;

-- Function to check usage limits
create or replace function check_usage_limit(org_email text)
returns table(
  within_limit boolean,
  current_usage int,
  limit_amount int,
  tier text
) language sql security definer as $$
  select 
    (page_views_used < page_views_limit) as within_limit,
    page_views_used as current_usage,
    page_views_limit as limit_amount,
    subscription_tier as tier
  from organizations 
  where email = org_email;
$$;

-- Test data (optional - uncomment if needed)
-- insert into organizations (email, company_name, subscription_tier, page_views_limit) values
-- ('test@equalshield.com', 'EqualShield Test', 'professional', 50000)
-- on conflict (email) do nothing;

-- Grant permissions to service role
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;