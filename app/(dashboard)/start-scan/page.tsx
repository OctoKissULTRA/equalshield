'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import LiveProgress from '@/components/dashboard/LiveProgress';
import { Globe, Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function StartScanPage() {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [depth, setDepth] = useState('standard');
  const [isScanning, setIsScanning] = useState(false);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startScan = async () => {
    if (!url || !email) {
      setError('Please provide both URL and email');
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          email,
          depth,
          tier: 'free' // TODO: Get from user's actual tier
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start scan');
      }

      const result = await response.json();
      setCurrentScanId(result.scanId);
      
    } catch (error) {
      console.error('Scan failed:', error);
      setError((error as Error).message);
      setIsScanning(false);
    }
  };

  const handleScanComplete = (results: any) => {
    console.log('Scan completed:', results);
    setIsScanning(false);
    // TODO: Navigate to results page or show results
  };

  const handleScanError = (error: string) => {
    console.error('Scan failed:', error);
    setError(error);
    setIsScanning(false);
    setCurrentScanId(null);
  };

  const resetScan = () => {
    setCurrentScanId(null);
    setIsScanning(false);
    setError(null);
    setUrl('');
    setEmail('');
    setDepth('standard');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Accessibility Scan</h1>
        <p className="text-gray-600 mt-1">
          Test your website for accessibility compliance and get detailed reports
        </p>
      </div>

      {/* Scan Form */}
      {!currentScanId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Start New Scan
            </CardTitle>
            <CardDescription>
              Enter your website URL and email to begin an accessibility audit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isScanning}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="depth">Scan Depth</Label>
              <Select value={depth} onValueChange={setDepth} disabled={isScanning}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scan depth" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quick">Quick (1 page, ~30 seconds)</SelectItem>
                  <SelectItem value="standard">Standard (up to 5 pages, ~2 minutes)</SelectItem>
                  <SelectItem value="deep">Deep (up to 50 pages, ~5 minutes)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button 
                onClick={startScan} 
                disabled={isScanning || !url || !email}
                className="flex items-center gap-2"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting Scan...
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4" />
                    Start Accessibility Scan
                  </>
                )}
              </Button>

              {error && (
                <Button variant="outline" onClick={() => setError(null)}>
                  Try Again
                </Button>
              )}
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">What we'll check:</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    <li>• WCAG 2.1 AA compliance</li>
                    <li>• Color contrast ratios</li>
                    <li>• Keyboard navigation</li>
                    <li>• Screen reader compatibility</li>
                    <li>• Alternative text for images</li>
                    <li>• Form accessibility</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Progress */}
      {currentScanId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Scan Progress</h2>
            <Button variant="outline" onClick={resetScan}>
              Start New Scan
            </Button>
          </div>
          
          <LiveProgress
            scanId={currentScanId}
            onComplete={handleScanComplete}
            onError={handleScanError}
          />
        </div>
      )}
    </div>
  );
}