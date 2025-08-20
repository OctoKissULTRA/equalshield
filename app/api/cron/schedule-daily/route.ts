export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/server';
import { db } from '@/lib/db/drizzle';
import { teams } from '@/lib/db/schema';
import { ne } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    // Verify this is a Vercel cron request
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🕐 Running daily scan scheduler...');

    // Get organizations with paid subscriptions
    const orgs = await db()
      .select({
        id: teams.id,
        name: teams.name,
        stripeCustomerId: teams.stripeCustomerId,
        planName: teams.planName
      })
      .from(teams)
      .where(ne(teams.planName, 'free'));

    if (!orgs.length) {
      return NextResponse.json({ 
        message: 'No paid organizations found',
        enqueued: 0 
      });
    }

    // Prepare daily scan jobs
    const supabase = createSupabaseClient();
    const jobs = orgs.map(org => ({
      org_id: org.id.toString(),
      url: `https://${org.name}`, // Assuming domain = team name for now
      depth: 'standard',
      priority: org.planName === 'enterprise' ? 1 : 5
    }));

    // Enqueue all daily scans
    const { data, error } = await supabase
      .from('scan_jobs')
      .insert(jobs);

    if (error) {
      console.error('❌ Failed to enqueue daily scans:', error);
      return NextResponse.json(
        { error: 'Failed to enqueue scans' },
        { status: 500 }
      );
    }

    console.log(`✅ Enqueued ${jobs.length} daily scans`);

    return NextResponse.json({
      message: 'Daily scans scheduled successfully',
      enqueued: jobs.length,
      organizations: orgs.map(o => ({ id: o.id, name: o.name, plan: o.planName }))
    });

  } catch (error) {
    console.error('❌ Daily scheduler error:', error);
    return NextResponse.json(
      { error: 'Scheduler failed' },
      { status: 500 }
    );
  }
}