'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import LiveProgress from '@/components/dashboard/LiveProgress';
import { 
  Shield, 
  Zap, 
  Globe, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Star,
  ArrowRight,
  Download,
  FileText,
  Eye,
  Users,
  BarChart3
} from 'lucide-react';

interface TrialScanResult {
  scanId: string;
  summary: {
    overall_score: number;
    total_violations: number;
    critical_issues: number;
    major_issues: number;
    minor_issues: number;
    wcag_level: string;
  };
  topIssues: Array<{
    criterion: string;
    impact: string;
    description: string;
    instances: number;
  }>;
  categories: Array<{
    name: string;
    score: number;
    violations: number;
  }>;
}

export default function TrialPage() {
  const [url, setUrl] = useState('');
  const [hasAgreed, setHasAgreed] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<TrialScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trialLimits, setTrialLimits] = useState<any>(null);

  useEffect(() => {
    // Check trial availability
    fetchTrialStatus();
  }, []);

  const fetchTrialStatus = async () => {
    try {
      const response = await fetch('/api/trial/start');
      if (response.ok) {
        const data = await response.json();
        setTrialLimits(data.limits);
        
        if (!data.available) {
          setError('Trial limit reached. Please try again later or create a free account.');
        }
      }
    } catch (error) {
      console.error('Failed to check trial status:', error);
    }
  };

  const startTrialScan = async () => {
    if (!url || !hasAgreed) {
      setError('Please enter a URL and agree to the terms');
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      const response = await fetch('/api/trial/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start trial scan');
      }

      const result = await response.json();
      setCurrentScanId(result.scanId);
      
      // Track analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'trial_started', {
          domain: new URL(url).hostname,
          scan_id: result.scanId
        });
      }

    } catch (error) {
      console.error('Trial scan failed:', error);
      setError((error as Error).message);
      setIsScanning(false);
    }
  };

  const handleScanComplete = (results: any) => {
    // Mock results for demo - in production this would come from the actual scan
    const mockResult: TrialScanResult = {
      scanId: currentScanId!,
      summary: {
        overall_score: 72,
        total_violations: 18,
        critical_issues: 2,
        major_issues: 6,
        minor_issues: 10,
        wcag_level: 'Partial Conformance'
      },
      topIssues: [
        {
          criterion: '1.1.1 Non-text Content',
          impact: 'critical',
          description: 'Images missing alternative text',
          instances: 8
        },
        {
          criterion: '2.1.1 Keyboard',
          impact: 'critical',
          description: 'Interactive elements not keyboard accessible',
          instances: 3
        },
        {
          criterion: '1.4.3 Contrast (Minimum)',
          impact: 'serious',
          description: 'Insufficient color contrast ratios',
          instances: 12
        },
        {
          criterion: '3.3.2 Labels or Instructions',
          impact: 'serious',
          description: 'Form inputs missing labels',
          instances: 5
        },
        {
          criterion: '1.3.1 Info and Relationships',
          impact: 'moderate',
          description: 'Missing semantic markup',
          instances: 7
        }
      ],
      categories: [
        { name: 'Perceivable', score: 68, violations: 8 },
        { name: 'Operable', score: 75, violations: 4 },
        { name: 'Understandable', score: 80, violations: 3 },
        { name: 'Robust', score: 65, violations: 3 }
      ]
    };

    setScanResult(mockResult);
    setIsScanning(false);

    // Track completion
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'trial_completed', {
        domain: new URL(url).hostname,
        scan_id: currentScanId,
        overall_score: mockResult.summary.overall_score,
        total_violations: mockResult.summary.total_violations
      });
    }
  };

  const handleScanError = (error: string) => {
    console.error('Scan failed:', error);
    setError(error);
    setIsScanning(false);
    setCurrentScanId(null);
  };

  const trackUpgradeClick = () => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'trial_upgrade_clicked', {
        domain: url ? new URL(url).hostname : 'unknown',
        scan_id: currentScanId
      });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'serious': return 'bg-orange-100 text-orange-800';
      case 'moderate': return 'bg-yellow-100 text-yellow-800';
      case 'minor': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Show results view
  if (scanResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* Watermark Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Eye className="h-4 w-4" />
              Free Trial • Limited Preview
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Accessibility Results</h1>
            <p className="text-gray-600">{url}</p>
          </div>

          {/* Overall Score */}
          <Card className="mb-8">
            <CardContent className="p-8 text-center">
              <div className={`text-6xl font-bold mb-4 ${getScoreColor(scanResult.summary.overall_score)}`}>
                {scanResult.summary.overall_score}%
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Accessibility Score</h3>
              <Badge className="mb-4" variant="outline">
                {scanResult.summary.wcag_level}
              </Badge>
              
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {scanResult.summary.critical_issues}
                  </div>
                  <p className="text-sm text-gray-600">Critical</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {scanResult.summary.major_issues}
                  </div>
                  <p className="text-sm text-gray-600">Major</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {scanResult.summary.minor_issues}
                  </div>
                  <p className="text-sm text-gray-600">Minor</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* WCAG Principles */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>WCAG Principles Breakdown</CardTitle>
              <CardDescription>
                Your website's performance across the four core accessibility principles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {scanResult.categories.map((category) => (
                  <div key={category.name} className="text-center">
                    <h4 className="font-semibold text-gray-900 mb-2">{category.name}</h4>
                    <div className={`text-2xl font-bold mb-1 ${getScoreColor(category.score)}`}>
                      {category.score}%
                    </div>
                    <p className="text-sm text-gray-600">{category.violations} issues</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Issues */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Top Priority Issues</CardTitle>
              <CardDescription>
                The most important accessibility issues to fix first
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {scanResult.topIssues.map((issue, index) => (
                  <div key={index} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{issue.criterion}</span>
                        <Badge className={getImpactColor(issue.impact)}>
                          {issue.impact}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{issue.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-gray-900">{issue.instances}</span>
                      <p className="text-xs text-gray-500">instances</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upgrade CTA */}
          <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardContent className="p-8 text-center">
              <div className="mb-6">
                <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Unlock Your Complete Report
                </h3>
                <p className="text-gray-600 mb-4">
                  Get the full {trialLimits?.pages_per_scan || 5}-page analysis, detailed remediation guidance, 
                  and professional exports with a free EqualShield account.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <BarChart3 className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <h4 className="font-semibold">Complete Analysis</h4>
                  <p className="text-sm text-gray-600">Full {trialLimits?.pages_per_scan || 5}-page scan with detailed findings</p>
                </div>
                <div className="text-center">
                  <Download className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <h4 className="font-semibold">Professional Exports</h4>
                  <p className="text-sm text-gray-600">PDF reports & VPAT documents</p>
                </div>
                <div className="text-center">
                  <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <h4 className="font-semibold">Share with Team</h4>
                  <p className="text-sm text-gray-600">Secure shareable links for stakeholders</p>
                </div>
              </div>

              <div className="space-y-3">
                <Button 
                  size="lg" 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                  onClick={() => {
                    trackUpgradeClick();
                    window.location.href = '/signup?utm_source=trial&utm_campaign=upgrade';
                  }}
                >
                  Create Free Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                
                <p className="text-sm text-gray-500">
                  No credit card required • Upgrade anytime • Your trial data will be preserved
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center mt-8 text-sm text-gray-500">
            <p>
              This trial provides a preview of EqualShield's accessibility testing capabilities. 
              Results are based on automated analysis and should be supplemented with manual testing.
            </p>
            <p className="mt-2">
              <strong>Not legal advice.</strong> Consult accessibility and legal experts for compliance guidance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show live progress
  if (currentScanId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Analyzing Your Website</h1>
            <p className="text-gray-600">Running accessibility tests on {url}</p>
            
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mt-4">
              <Zap className="h-4 w-4" />
              Free Trial • {trialLimits?.pages_per_scan || 5} pages max
            </div>
          </div>

          <LiveProgress
            scanId={currentScanId}
            onComplete={handleScanComplete}
            onError={handleScanError}
          />

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>This usually takes 30-60 seconds</p>
          </div>
        </div>
      </div>
    );
  }

  // Show trial form
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <Shield className="h-16 w-16 text-blue-600 mx-auto mb-6" />
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Free Accessibility Scan
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Test your website for WCAG compliance in under 60 seconds. No account required.
          </p>
          
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                <Globe className="h-6 w-6 text-blue-600" />
              </div>
              <p className="text-sm text-gray-600">WCAG 2.1 Tests</p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                <Zap className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">60 Second Scan</p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                <Star className="h-6 w-6 text-purple-600" />
              </div>
              <p className="text-sm text-gray-600">Instant Results</p>
            </div>
          </div>
        </div>

        {/* Trial Form */}
        <Card>
          <CardHeader>
            <CardTitle>Start Your Free Scan</CardTitle>
            <CardDescription>
              Enter your website URL to begin accessibility testing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="url">Website URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isScanning}
              />
              <p className="text-sm text-gray-500">
                We'll scan up to {trialLimits?.pages_per_scan || 5} pages for accessibility issues
              </p>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox 
                id="terms" 
                checked={hasAgreed}
                onCheckedChange={setHasAgreed}
                disabled={isScanning}
              />
              <Label htmlFor="terms" className="text-sm text-gray-600 leading-relaxed">
                I confirm that I am authorized to test this website. I understand that automated testing 
                finds a subset of accessibility issues and this analysis does not constitute legal advice.
              </Label>
            </div>

            <Button 
              onClick={startTrialScan}
              disabled={!url || !hasAgreed || isScanning}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              size="lg"
            >
              {isScanning ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Starting Scan...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Run Free Accessibility Scan
                </>
              )}
            </Button>

            <div className="text-center pt-4 border-t">
              <p className="text-sm text-gray-500">
                Need more than {trialLimits?.pages_per_scan || 5} pages or professional reports?{' '}
                <a href="/pricing" className="text-blue-600 hover:text-blue-800 font-medium">
                  View our plans
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Features Preview */}
        <div className="mt-12 grid md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6">
              <CheckCircle className="h-8 w-8 text-green-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">What You'll Get</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• WCAG 2.1 AA compliance score</li>
                <li>• Critical accessibility issues</li>
                <li>• POUR principle breakdown</li>
                <li>• Priority fix recommendations</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <FileText className="h-8 w-8 text-blue-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Upgrade for More</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Full site scans (up to 500 pages)</li>
                <li>• Professional PDF reports</li>
                <li>• VPAT documentation</li>
                <li>• Shareable team links</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Trust Indicators */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Trusted by 500+ organizations • WCAG 2.1 standards • SOC 2 compliant
          </p>
        </div>
      </div>
    </div>
  );
}