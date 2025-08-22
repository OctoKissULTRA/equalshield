'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ShareManager from '@/components/reports/ShareManager';
import { 
  Shield, 
  Calendar, 
  Globe, 
  Download, 
  FileText,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';

interface ScanReport {
  id: string;
  url: string;
  status: string;
  created_at: string;
  updated_at: string;
  summary?: {
    overall_score: number;
    total_violations: number;
    critical_issues: number;
    major_issues: number;
    minor_issues: number;
    wcag_level: string;
  };
}

interface ReportPageProps {
  params: { scanId: string };
}

export default function ReportPage({ params }: ReportPageProps) {
  const { scanId } = params;
  const [report, setReport] = useState<ScanReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReport();
  }, [scanId]);

  const fetchReport = async () => {
    try {
      // For demo purposes, create mock data
      // In production, this would fetch from your API
      const mockReport: ScanReport = {
        id: scanId,
        url: 'https://example.com',
        status: 'completed',
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        summary: {
          overall_score: 78,
          total_violations: 23,
          critical_issues: 3,
          major_issues: 8,
          minor_issues: 12,
          wcag_level: 'Partial Conformance'
        }
      };
      
      setReport(mockReport);
    } catch (error) {
      console.error('Failed to fetch report:', error);
      setError('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    // In production, this would use the actual PDF API
    const url = `/api/reports/${scanId}/pdf`;
    window.open(url, '_blank');
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'pending': return <Clock className="h-5 w-5 text-blue-500" />;
      default: return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Report Not Found</h2>
        <p className="text-gray-600">{error || 'The requested report could not be found.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-blue-600" />
            Accessibility Report
          </h1>
          <div className="flex items-center gap-4 mt-2 text-gray-600">
            <div className="flex items-center gap-1">
              <Globe className="h-4 w-4" />
              <span>{report.url}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(report.created_at)}</span>
            </div>
            <div className="flex items-center gap-1">
              {getStatusIcon(report.status)}
              <span className="capitalize">{report.status}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={downloadPDF} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Export VPAT
          </Button>
        </div>
      </div>

      {/* Report Summary */}
      {report.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Summary
            </CardTitle>
            <CardDescription>
              Overall accessibility compliance summary
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className={`text-3xl font-bold ${getScoreColor(report.summary.overall_score)}`}>
                  {report.summary.overall_score}%
                </div>
                <p className="text-sm text-gray-600 mt-1">Overall Score</p>
                <Badge className="mt-2" variant="outline">
                  {report.summary.wcag_level}
                </Badge>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {report.summary.total_violations}
                </div>
                <p className="text-sm text-gray-600 mt-1">Total Issues</p>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">
                  {report.summary.critical_issues}
                </div>
                <p className="text-sm text-gray-600 mt-1">Critical</p>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">
                  {report.summary.major_issues}
                </div>
                <p className="text-sm text-gray-600 mt-1">Major</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Share Manager */}
      {report.status === 'completed' && (
        <ShareManager 
          scanId={report.id}
          scanUrl={report.url}
          orgId="1" // This should come from the authenticated session
        />
      )}

      {/* Placeholder for detailed report content */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Findings</CardTitle>
          <CardDescription>
            Complete accessibility audit results and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4" />
            <p>Detailed report content would be displayed here.</p>
            <p className="text-sm mt-2">
              This would include WCAG violations, recommendations, and implementation guidance.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}