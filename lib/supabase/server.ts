// Server-side Supabase client for job queue operations
import { createClient } from '@supabase/supabase-js';

export function createSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Type definitions for job queue
export interface ScanJob {
  id: string;
  org_id: string;
  url: string;
  depth: 'quick' | 'standard' | 'deep';
  status: 'queued' | 'claimed' | 'processing' | 'done' | 'failed';
  priority: number;
  attempts: number;
  last_error?: string;
  created_at: string;
  claimed_at?: string;
  completed_at?: string;
  worker_id?: string;
  scan_id?: number;
}

export interface WorkerHeartbeat {
  worker_id: string;
  last_heartbeat: string;
  status: string;
  jobs_processed: number;
  last_job_at?: string;
}