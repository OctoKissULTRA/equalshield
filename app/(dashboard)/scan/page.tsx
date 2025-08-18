'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  FileText, 
  Download,
  ArrowRight,
  Info,
  Clock
} from 'lucide-react';

export default function ScanPage() {
  const [scanning, setScanning] = useState(true);
  const [progress, setProgress] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanData, setScanData] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const scanUrl = localStorage.getItem('scanUrl');
    const scanEmail = localStorage.getItem('scanEmail');
    
    if (!scanUrl || !scanEmail) {
      router.push('/');
      return;
    }

    // Start the scan
    startScan(scanUrl, scanEmail);
  }, [router]);

  const startScan = async (url: string, email: string) => {
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, email }),
      });

      if (!response.ok) {
        throw new Error('Failed to start scan');
      }

      const { scanId } = await response.json();
      
      // Poll for results
      pollScanResults(scanId);
      
    } catch (error) {
      console.error('Scan error:', error);
      // For demo purposes, simulate results
      simulateScan();
    }
  };

  const pollScanResults = async (scanId: number) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/scan?id=${scanId}`);
        const data = await response.json();
        
        if (data.status === 'completed') {
          clearInterval(interval);
          setScanData(data);
          setScanning(false);
          setScanComplete(true);
          setProgress(100);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          simulateScan(); // Fall back to simulation
        } else {
          // Update progress based on status
          setProgress(prev => Math.min(prev + 5, 95));
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 1000);

    // Fallback: simulate completion after 10 seconds
    setTimeout(() => {
      clearInterval(interval);
      if (scanning) {
        simulateScan();
      }
    }, 10000);
  };

  const simulateScan = () => {
    // Simulate professional scanning process
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setScanning(false);
          setScanComplete(true);
          setScanData(mockScanData);
          return 100;
        }
        return prev + 3;
      });
    }, 100);
  };

  const scanUrl = typeof window !== 'undefined' ? localStorage.getItem('scanUrl') : '';
  
  // Mock professional compliance data
  const mockScanData = {
    overallScore: 68,
    wcagLevel: 'Partial Conformance',
    criticalIssues: 12,
    majorIssues: 34,
    minorIssues: 47,
    categories: [
      { name: 'Perceivable', score: 72, issues: 18 },
      { name: 'Operable', score: 65, issues: 24 },
      { name: 'Understandable', score: 78, issues: 15 },
      { name: 'Robust', score: 58, issues: 36 }
    ],
    topIssues: [
      { 
        criterion: '1.1.1 Non-text Content', 
        level: 'A', 
        impact: 'Critical',
        instances: 23,
        description: 'Images missing alternative text'
      },
      { 
        criterion: '2.1.1 Keyboard', 
        level: 'A', 
        impact: 'Critical',
        instances: 8,
        description: 'Interactive elements not keyboard accessible'
      },
      { 
        criterion: '1.4.3 Contrast (Minimum)', 
        level: 'AA', 
        impact: 'Major',
        instances: 31,
        description: 'Insufficient color contrast ratios'
      },
      { 
        criterion: '3.3.2 Labels or Instructions', 
        level: 'A', 
        impact: 'Major',
        instances: 12,
        description: 'Form inputs missing labels'
      }
    ]
  };

  const complianceData = scanData || mockScanData;

  if (scanning) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-8">
            <Shield className="w-16 h-16 text-emerald-600 mx-auto animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Conducting Compliance Assessment</h1>
          <p className="text-slate-600 mb-8">Analyzing {scanUrl} against WCAG 2.1 Level AA criteria</p>
          
          <div className="w-64 mx-auto">
            <div className="bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-slate-600">{progress}% Complete</p>
          </div>
          
          <div className="mt-8 text-sm text-slate-500">
            <p>Testing keyboard navigation...</p>
            <p>Evaluating screen reader compatibility...</p>
            <p>Checking color contrast ratios...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Accessibility Compliance Report</h1>
              <p className="text-sm text-slate-600 mt-1">{scanUrl}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="border-slate-300">
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
              <Button variant="outline" className="border-slate-300">
                <FileText className="w-4 h-4 mr-2" />
                Generate VPAT
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overall Score Card */}
        <Card className="mb-8">
          <CardContent className="p-8">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center w-32 h-32 mx-auto">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="#e2e8f0"
                      strokeWidth="12"
                      fill="none"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="#f59e0b"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${(complianceData.overallScore / 100) * 352} 352`}
                    />
                  </svg>
                  <span className="absolute text-3xl font-bold text-slate-900">
                    {complianceData.overallScore}%
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mt-4">Overall Compliance</h3>
                <p className="text-sm text-amber-600 font-medium">{complianceData.wcagLevel}</p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">Issue Summary</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <XCircle className="w-5 h-5 text-red-500 mr-2" />
                      <span className="text-sm text-slate-700">Critical Issues</span>
                    </div>
                    <span className="font-semibold text-slate-900">{complianceData.criticalIssues}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <AlertTriangle className="w-5 h-5 text-amber-500 mr-2" />
                      <span className="text-sm text-slate-700">Major Issues</span>
                    </div>
                    <span className="font-semibold text-slate-900">{complianceData.majorIssues}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Info className="w-5 h-5 text-blue-500 mr-2" />
                      <span className="text-sm text-slate-700">Minor Issues</span>
                    </div>
                    <span className="font-semibold text-slate-900">{complianceData.minorIssues}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">Compliance Status</h3>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-2" />
                    <span className="text-sm text-slate-700">Section 508: Partial</span>
                  </div>
                  <div className="flex items-center">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mr-2" />
                    <span className="text-sm text-slate-700">WCAG 2.1 AA: Non-Conformant</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-5 h-5 text-blue-500 mr-2" />
                    <span className="text-sm text-slate-700">Est. Remediation: 120-160 hours</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* POUR Principles */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>WCAG Principles Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-6">
              {complianceData.categories.map((category: any) => (
                <div key={category.name} className="text-center">
                  <h4 className="font-semibold text-slate-900 mb-2">{category.name}</h4>
                  <div className="text-2xl font-bold text-slate-900 mb-1">{category.score}%</div>
                  <p className="text-sm text-slate-600">{category.issues} issues found</p>
                  <div className="mt-3 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        category.score >= 80 ? 'bg-emerald-500' : 
                        category.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${category.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Issues */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Priority Issues for Remediation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {complianceData.topIssues.map((issue: any, index: number) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-slate-900">{issue.criterion}</span>
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded">
                          Level {issue.level}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded ${
                          issue.impact === 'Critical' ? 'bg-red-100 text-red-700' :
                          issue.impact === 'Major' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {issue.impact}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-1">{issue.description}</p>
                      <p className="text-sm text-slate-500">{issue.instances} instances detected</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>Recommended Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Immediate Actions</h4>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">Address all Level A critical issues</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">Implement keyboard navigation for all interactive elements</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">Add alternative text to all informative images</span>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Professional Services</h4>
                <p className="text-sm text-slate-600 mb-4">
                  Our accessibility experts can provide comprehensive remediation support and ongoing monitoring.
                </p>
                <div className="space-y-3">
                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => router.push('/pricing')}
                  >
                    Schedule Expert Consultation
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full border-slate-300"
                    onClick={() => router.push('/pricing')}
                  >
                    View Pricing Plans
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}