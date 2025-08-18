-- Core tables for the ADA compliance scanner

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE NOT NULL,
  industry VARCHAR(100),
  estimated_revenue VARCHAR(50),
  subscription_tier VARCHAR(50) DEFAULT 'free',
  stripe_customer_id VARCHAR(255),
  scans_this_month INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  scan_type VARCHAR(50), -- 'quick', 'deep', 'exhaustive'
  wcag_level VARCHAR(3) DEFAULT 'AA',
  status VARCHAR(50), -- 'pending', 'scanning', 'analyzing', 'complete', 'failed'
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  
  -- Results
  compliance_score INTEGER, -- 0-100
  lawsuit_risk_score INTEGER, -- 0-100
  total_violations INTEGER,
  critical_violations INTEGER,
  serious_violations INTEGER,
  moderate_violations INTEGER,
  minor_violations INTEGER,
  
  -- Metadata
  pages_scanned INTEGER,
  elements_analyzed INTEGER,
  processing_time_ms INTEGER,
  llm_tokens_used INTEGER,
  
  -- Detailed results
  scan_results JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  
  -- Violation details
  wcag_criterion VARCHAR(20), -- 'WCAG 1.1.1'
  severity VARCHAR(20), -- 'critical', 'serious', 'moderate', 'minor'
  element_selector TEXT,
  element_html TEXT,
  page_url TEXT,
  
  -- Analysis
  description TEXT,
  user_impact TEXT,
  legal_risk VARCHAR(20), -- 'high', 'medium', 'low'
  lawsuit_probability DECIMAL(5,2), -- percentage
  
  -- Fixes
  fix_description TEXT,
  fix_code TEXT,
  auto_fixable BOOLEAN DEFAULT FALSE,
  fix_complexity VARCHAR(20), -- 'trivial', 'simple', 'moderate', 'complex'
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'open', -- 'open', 'in_progress', 'fixed', 'ignored', 'false_positive'
  fixed_at TIMESTAMP,
  verified_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lawsuit_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  
  -- Risk assessment
  overall_risk_score INTEGER, -- 0-100
  lawsuit_probability DECIMAL(5,2),
  estimated_settlement_min INTEGER,
  estimated_settlement_max INTEGER,
  serial_plaintiff_score INTEGER, -- 1-10
  
  -- Similar cases
  similar_case_defendant VARCHAR(255),
  similar_case_settlement INTEGER,
  similar_case_year INTEGER,
  similar_violations JSONB,
  
  -- Recommendations
  immediate_actions JSONB,
  urgent_actions JSONB,
  standard_actions JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  compliance_score INTEGER,
  violation_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  type VARCHAR(50), -- 'score_drop', 'new_violation', 'competitor_sued', 'fix_verified'
  severity VARCHAR(20),
  title VARCHAR(255),
  message TEXT,
  data JSONB,
  sent_at TIMESTAMP,
  acknowledged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Lawsuit tracking table
CREATE TABLE IF NOT EXISTS ada_lawsuits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  defendant VARCHAR(255),
  plaintiff VARCHAR(255),
  filed_date DATE,
  settlement_amount INTEGER,
  violations_cited JSONB,
  industry VARCHAR(100),
  state VARCHAR(2),
  case_number VARCHAR(100),
  outcome VARCHAR(50), -- 'settled', 'dismissed', 'judgment', 'pending'
  court_documents TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Compliance reports
CREATE TABLE IF NOT EXISTS compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  report_type VARCHAR(50), -- 'executive', 'technical', 'vpat', 'legal'
  format VARCHAR(20), -- 'pdf', 'html', 'json'
  file_url TEXT,
  generated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Fix tracking
CREATE TABLE IF NOT EXISTS fix_implementations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_id UUID REFERENCES violations(id) ON DELETE CASCADE,
  implementation_code TEXT,
  commit_hash VARCHAR(255),
  pr_url TEXT,
  implemented_by VARCHAR(255),
  implemented_at TIMESTAMP,
  verified_by_scan UUID REFERENCES scans(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scans_org_id ON scans(organization_id);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_violations_scan_id ON violations(scan_id);
CREATE INDEX IF NOT EXISTS idx_violations_severity ON violations(severity);
CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status);
CREATE INDEX IF NOT EXISTS idx_violations_legal_risk ON violations(legal_risk);
CREATE INDEX IF NOT EXISTS idx_scan_history_org_id ON scan_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_created_at ON scan_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_org_id ON alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_ada_lawsuits_industry ON ada_lawsuits(industry);
CREATE INDEX IF NOT EXISTS idx_ada_lawsuits_filed_date ON ada_lawsuits(filed_date DESC);

-- Functions and triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();