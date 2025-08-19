'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Download, 
  Github, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  ExternalLink,
  Zap,
  BarChart3,
  Users
} from 'lucide-react';

interface ScanData {
  id: number;
  url: string;
  domain: string;
  status: string;
  wcagScore: number;
  adaRiskScore: number;
  lawsuitProbability: string;
  totalViolations: number;
  criticalViolations: number;
  seriousViolations: number;
  moderateViolations: number;
  minorViolations: number;
}

export default function ScanActionsPage() {
  const params = useParams();
  const scanId = params.id as string;
  
  const [scan, setScan] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // GitHub PR form
  const [repoUrl, setRepoUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [framework, setFramework] = useState('react');
  
  // Action results
  const [prUrl, setPrUrl] = useState('');
  const [pdfGenerated, setPdfGenerated] = useState(false);

  useEffect(() => {
    fetchScanData();
  }, [scanId]);

  const fetchScanData = async () => {
    try {
      const response = await fetch(`/api/scan/${scanId}`);
      if (response.ok) {
        const data = await response.json();
        setScan(data);
      }
    } catch (error) {
      console.error('Failed to fetch scan data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    setActionLoading('pdf');
    try {
      const response = await fetch(`/api/report/pdf?scanId=${scanId}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ada-report-${scan?.domain}-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setPdfGenerated(true);
      } else {
        alert('Failed to generate PDF report');
      }
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF report');
    } finally {
      setActionLoading(null);
    }
  };

  const createGitHubPR = async () => {
    if (!repoUrl || !githubToken) {
      alert('Please provide repository URL and GitHub token');
      return;
    }

    setActionLoading('github');
    try {
      const response = await fetch('/api/fixes/github-pr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scanId: parseInt(scanId),
          repoUrl,
          githubToken,
          framework
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setPrUrl(data.prUrl);
        alert(`Successfully created PR with ${data.fixesApplied} fixes!`);
      } else {
        alert(data.error || 'Failed to create PR');
      }
    } catch (error) {
      console.error('PR creation failed:', error);
      alert('Failed to create GitHub PR');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (!scan) {
    return <div className="text-center py-8">Scan not found</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Take Action</h1>
        <p className="text-gray-600">Turn your accessibility findings into real fixes</p>
      </div>

      {/* Scan Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Scan Summary: {scan.domain}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{scan.wcagScore}</div>
              <div className="text-sm text-gray-600">WCAG Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{scan.adaRiskScore}</div>
              <div className="text-sm text-gray-600">ADA Risk Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{scan.lawsuitProbability}%</div>
              <div className="text-sm text-gray-600">Lawsuit Probability</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{scan.totalViolations}</div>
              <div className="text-sm text-gray-600">Total Violations</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* PDF Report Generation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Executive Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Generate a professional PDF report for executives, legal teams, and stakeholders.
            </p>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Report includes:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Executive summary with legal risk assessment</li>
                <li>• Detailed violation breakdown with severity levels</li>
                <li>• Step-by-step fix instructions with code examples</li>
                <li>• Business impact analysis and timeline</li>
                <li>• Legal disclaimer and compliance guidance</li>
              </ul>
            </div>

            <Button 
              onClick={generatePDF}
              disabled={actionLoading === 'pdf'}
              className="w-full"
            >
              {actionLoading === 'pdf' ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF Report
                </>
              )}
            </Button>

            {pdfGenerated && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle className="h-4 w-4" />
                PDF report downloaded successfully!
              </div>
            )}
          </CardContent>
        </Card>

        {/* GitHub PR Auto-Fix */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              Auto-Fix with GitHub PR
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Automatically create a pull request with code fixes for common accessibility issues.
            </p>

            <div className="space-y-3">
              <div>
                <Label htmlFor="repoUrl">GitHub Repository URL</Label>
                <Input
                  id="repoUrl"
                  type="url"
                  placeholder="https://github.com/username/repository"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="githubToken">GitHub Personal Access Token</Label>
                <Input
                  id="githubToken"
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Need repo permissions. <a href="https://github.com/settings/tokens" target="_blank" className="text-blue-600 hover:underline">Create token</a>
                </p>
              </div>

              <div>
                <Label htmlFor="framework">Framework</Label>
                <select
                  id="framework"
                  value={framework}
                  onChange={(e) => setFramework(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="react">React/Next.js</option>
                  <option value="html">HTML/Vanilla JS</option>
                  <option value="vue">Vue.js</option>
                </select>
              </div>
            </div>

            <Button 
              onClick={createGitHubPR}
              disabled={actionLoading === 'github' || !repoUrl || !githubToken}
              className="w-full"
            >
              {actionLoading === 'github' ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating PR...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Create Auto-Fix PR
                </>
              )}
            </Button>

            {prUrl && (
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-green-600 text-sm mb-2">
                  <CheckCircle className="h-4 w-4" />
                  Pull request created successfully!
                </div>
                <a 
                  href={prUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                >
                  View PR on GitHub <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Share Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="justify-start">
              <ExternalLink className="h-4 w-4 mr-2" />
              Share Public Link
            </Button>
            
            <Button variant="outline" className="justify-start">
              <FileText className="h-4 w-4 mr-2" />
              Export CSV Data
            </Button>
            
            <Button variant="outline" className="justify-start">
              <AlertCircle className="h-4 w-4 mr-2" />
              Schedule Monitoring
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Critical Issues Alert */}
      {scan.criticalViolations > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-900">
                  {scan.criticalViolations} Critical Issues Found
                </h3>
                <p className="text-red-700 text-sm">
                  These violations pose high legal risk and should be addressed immediately. 
                  Consider using the auto-fix PR to resolve common issues quickly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}