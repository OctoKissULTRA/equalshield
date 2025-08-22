import Link from "next/link";
import { createSupabaseClient } from '@/lib/supabase/server';
import { getCachedSampleShareUrl } from '@/lib/share/publish';
import { Shield, Download, ExternalLink, BarChart3, FileText, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import TrustAnalytics from '@/components/analytics/TrustAnalytics';

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ScanData {
  id: string;
  finished_at: string;
  score: number;
  pour_scores: {
    perceivable: number;
    operable: number;
    understandable: number;
    robust: number;
  } | null;
  url: string;
  domain: string;
}

async function getLatestSelfScan(): Promise<ScanData | null> {
  const domain = process.env.SELF_SCAN_URL ? new URL(process.env.SELF_SCAN_URL).hostname : "equalshield.com";
  const supabase = createSupabaseClient();
  
  const { data: latest, error } = await supabase
    .from('scans')
    .select('id, finished_at, score, pour_scores, url, domain')
    .eq('domain', domain)
    .eq('status', 'completed')
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !latest) {
    console.error('Failed to fetch latest scan:', error);
    return null;
  }

  return latest;
}

function formatScanDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreBadgeVariant(score: number): "default" | "secondary" | "destructive" | "outline" {
  if (score >= 80) return 'default';
  if (score >= 60) return 'secondary';
  return 'destructive';
}

export default async function TrustPage() {
  const latest = await getLatestSelfScan();
  const shareUrl = getCachedSampleShareUrl();
  const domain = process.env.SELF_SCAN_URL ? new URL(process.env.SELF_SCAN_URL).hostname : "equalshield.com";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Shield className="h-4 w-4" />
            Trust & Transparency
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Trust & Accessibility
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            We regularly test <strong>{domain}</strong> against WCAG A/AA using the same engine our customers use.
            Automated results guide engineering; manual review is still recommended.
          </p>
        </div>

        {/* Latest Scan Results */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Latest Accessibility Scan
            </CardTitle>
            <CardDescription>
              Our most recent automated WCAG A/AA compliance check
            </CardDescription>
          </CardHeader>
          <CardContent>
            {latest ? (
              <div className="space-y-6">
                {/* Overall Score */}
                <div className="text-center pb-6 border-b">
                  <div className={`text-5xl font-bold mb-2 ${getScoreColor(latest.score)}`}>
                    {latest.score}%
                  </div>
                  <p className="text-gray-600 mb-3">Overall Conformance Score</p>
                  <Badge variant={getScoreBadgeVariant(latest.score)} className="mb-2">
                    WCAG A/AA
                  </Badge>
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                    <Calendar className="h-4 w-4" />
                    Last scanned: {formatScanDate(latest.finished_at)}
                  </div>
                </div>

                {/* POUR Scores */}
                {latest.pour_scores && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">WCAG Principles Breakdown</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className={`text-2xl font-bold mb-1 ${getScoreColor(latest.pour_scores.perceivable)}`}>
                          {latest.pour_scores.perceivable}%
                        </div>
                        <p className="text-sm text-gray-600">Perceivable</p>
                      </div>
                      <div className="text-center">
                        <div className={`text-2xl font-bold mb-1 ${getScoreColor(latest.pour_scores.operable)}`}>
                          {latest.pour_scores.operable}%
                        </div>
                        <p className="text-sm text-gray-600">Operable</p>
                      </div>
                      <div className="text-center">
                        <div className={`text-2xl font-bold mb-1 ${getScoreColor(latest.pour_scores.understandable)}`}>
                          {latest.pour_scores.understandable}%
                        </div>
                        <p className="text-sm text-gray-600">Understandable</p>
                      </div>
                      <div className="text-center">
                        <div className={`text-2xl font-bold mb-1 ${getScoreColor(latest.pour_scores.robust)}`}>
                          {latest.pour_scores.robust}%
                        </div>
                        <p className="text-sm text-gray-600">Robust</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-4">
                  {shareUrl && (
                    <Button asChild>
                      <Link href={shareUrl} className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        View Sample Report
                      </Link>
                    </Button>
                  )}
                  {latest && (
                    <Button variant="outline" asChild>
                      <Link href={`/api/reports/${latest.id}/pdf`} className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Download Sample PDF
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4">
                  <FileText className="h-12 w-12 mx-auto" />
                </div>
                <p className="text-gray-600">No recent scans available.</p>
                <p className="text-sm text-gray-500 mt-2">
                  Scans are performed weekly. Check back soon for fresh results.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* What the Report Shows */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>What Our Reports Include</CardTitle>
            <CardDescription>
              Professional accessibility analysis with actionable insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Technical Analysis</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• WCAG A/AA compliance checks</li>
                  <li>• POUR principle scoring</li>
                  <li>• Critical issue prioritization</li>
                  <li>• Element-level findings</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Actionable Guidance</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Code-level fix suggestions</li>
                  <li>• Quick wins identification</li>
                  <li>• Implementation guidelines</li>
                  <li>• Shareable stakeholder links</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Try It Yourself */}
        <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Try EqualShield Free
              </h3>
              <p className="text-gray-600 mb-4">
                Run a free trial scan on your website. See what we see.
              </p>
            </div>

            <Button asChild size="lg" className="mb-6">
              <Link href="/trial">
                Run a Free Trial Scan
              </Link>
            </Button>

            <div className="text-sm text-gray-500 max-w-md mx-auto">
              <p className="mb-2">
                <strong>Hero:</strong> "Measure WCAG A/AA conformance. Prioritize fixes. Export clean, shareable reports."
              </p>
              <p>
                Automated checks with engineering guidance. Manual review recommended. Not legal advice.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Legal Disclaimer */}
        <div className="text-center mt-8 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            <strong>Disclaimer:</strong> EqualShield provides automated technical testing & guidance against WCAG. It's not legal advice.
          </p>
        </div>
      </div>

      {/* Analytics Tracking Component */}
      <TrustAnalytics 
        latestScanId={latest?.id}
        latestScanScore={latest?.score}
        hasSampleLink={!!shareUrl}
      />
    </div>
  );
}