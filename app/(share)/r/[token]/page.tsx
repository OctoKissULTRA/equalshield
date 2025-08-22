import { notFound } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/server';
import { hashToken, validateTokenAccess, extractToken } from '@/lib/share';
import { getPublicReport } from '@/lib/reports/public';
import PublicReportView from '@/components/reports/PublicReportView';

interface SharePageProps {
  params: { token: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function SharePage({ params, searchParams }: SharePageProps) {
  const rawToken = extractToken(
    params.token,
    undefined, // No auth header available in server component
    Array.isArray(searchParams.t) ? searchParams.t[0] : searchParams.t
  );

  if (!rawToken) {
    return notFound();
  }

  const supabase = createSupabaseClient();
  const tokenHash = hashToken(rawToken);

  // Find the share token
  const { data: shareToken, error } = await supabase
    .from('share_tokens')
    .select(`
      id,
      org_id,
      scan_id,
      token_hash,
      expires_at,
      revoked_at,
      max_views,
      views
    `)
    .eq('token_hash', tokenHash)
    .single();

  if (error || !shareToken) {
    return notFound();
  }

  // Validate token access
  const validation = validateTokenAccess(
    {
      expires_at: new Date(shareToken.expires_at),
      revoked_at: shareToken.revoked_at ? new Date(shareToken.revoked_at) : null,
      views: shareToken.views,
      max_views: shareToken.max_views,
      token_hash: shareToken.token_hash
    },
    rawToken
  );

  if (!validation.valid) {
    return notFound();
  }

  // Increment view count (best-effort, don't block on failure)
  try {
    await supabase
      .from('share_tokens')
      .update({ views: shareToken.views + 1 })
      .eq('id', shareToken.id);
  } catch (updateError) {
    console.error('Failed to increment view count:', updateError);
    // Continue anyway - don't block the user
  }

  // Fetch the public report data
  const reportData = await getPublicReport(shareToken.scan_id);

  if (!reportData) {
    return notFound();
  }

  // Check if organization has watermark removal feature
  // TODO: Get organization entitlements to check watermark feature
  const showWatermark = true; // For now, always show watermark on shared reports

  return (
    <PublicReportView 
      report={reportData} 
      watermark={showWatermark}
      viewInfo={{
        views: shareToken.views + 1,
        maxViews: shareToken.max_views,
        expiresAt: shareToken.expires_at
      }}
    />
  );
}

// Generate metadata for the shared report
export async function generateMetadata({ params }: SharePageProps) {
  const rawToken = extractToken(params.token);
  
  if (!rawToken) {
    return {
      title: 'Report Not Found',
      description: 'The requested accessibility report could not be found.'
    };
  }

  // Try to get basic report info for metadata
  try {
    const supabase = createSupabaseClient();
    const tokenHash = hashToken(rawToken);

    const { data: shareToken } = await supabase
      .from('share_tokens')
      .select(`
        scan_id,
        expires_at,
        revoked_at,
        scans!inner(url, created_at)
      `)
      .eq('token_hash', tokenHash)
      .single();

    if (shareToken && !shareToken.revoked_at && new Date(shareToken.expires_at) > new Date()) {
      const scan = shareToken.scans as any;
      const domain = new URL(scan.url).hostname;
      const scanDate = new Date(scan.created_at).toLocaleDateString();

      return {
        title: `Accessibility Report - ${domain}`,
        description: `WCAG 2.1 accessibility compliance report for ${domain}, generated on ${scanDate}. View detailed findings and recommendations.`,
        openGraph: {
          title: `Accessibility Report - ${domain}`,
          description: `WCAG 2.1 accessibility compliance report for ${domain}`,
          type: 'website',
        },
        robots: {
          index: false, // Don't index shared reports
          follow: false
        }
      };
    }
  } catch (error) {
    console.error('Failed to generate metadata:', error);
  }

  return {
    title: 'Accessibility Report',
    description: 'Shared accessibility compliance report powered by EqualShield',
    robots: {
      index: false,
      follow: false
    }
  };
}