'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PublicReportData } from '@/lib/reports/public';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Info,
  Clock,
  Globe,
  Download,
  ExternalLink,
  Eye,
  Calendar,
  FileText,
  Lightbulb
} from 'lucide-react';

interface PublicReportViewProps {
  report: PublicReportData;
  watermark?: boolean;
  viewInfo?: {
    views: number;
    maxViews: number;
    expiresAt: string;
  };
}

export default function PublicReportView({ report, watermark = true, viewInfo }: PublicReportViewProps) {
  const [showAllViolations, setShowAllViolations] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBackground = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'critical': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'serious': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'moderate': return <Info className="h-4 w-4 text-yellow-500" />;
      case 'minor': return <Info className="h-4 w-4 text-blue-500" />;
      default: return <Info className="h-4 w-4 text-gray-500" />;
    }
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
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

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const visibleViolations = showAllViolations ? report.violations : report.violations.slice(0, 5);

  return (
    <div className={`min-h-screen bg-gray-50 ${watermark ? 'relative' : ''}`}>
      {/* Watermark */}
      {watermark && (
        <div className="fixed inset-0 pointer-events-none z-10 flex items-center justify-center">
          <div className="transform rotate-45 text-gray-200 text-6xl font-bold opacity-10 select-none">
            EqualShield Demo
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 relative z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Shield className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Accessibility Report</h1>
                <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                  <Globe className="h-4 w-4" />
                  <span className="truncate max-w-md">{report.scan.url}</span>
                  <span>•</span>
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(report.scan.created_at)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {viewInfo && (
                <div className="text-sm text-gray-500 flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  <span>{viewInfo.views} / {viewInfo.maxViews} views</span>
                </div>
              )}
              
              <Button variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>
          
          {viewInfo && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                This shared report expires on {formatDate(viewInfo.expiresAt)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-20">
        {/* Overall Score */}
        <Card className="mb-8">
          <CardContent className="p-8">
            <div className="grid md:grid-cols-3 gap-8">
              {/* Score Circle */}
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
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${(report.summary.overall_score / 100) * 352} 352`}
                      className={getScoreColor(report.summary.overall_score)}
                    />
                  </svg>
                  <span className="absolute text-3xl font-bold text-gray-900">
                    {report.summary.overall_score}%
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mt-4">Accessibility Score</h3>
                <Badge className={getImpactColor(report.summary.overall_score >= 80 ? 'minor' : 'serious')}>
                  {report.summary.wcag_level}
                </Badge>
              </div>
              
              {/* Issue Summary */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Issues Found</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-500" />
                      <span className="text-sm text-gray-700">Critical</span>
                    </div>
                    <span className="font-semibold text-gray-900">{report.summary.critical_issues}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      <span className="text-sm text-gray-700">Major</span>
                    </div>
                    <span className="font-semibold text-gray-900">{report.summary.major_issues}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Info className="h-5 w-5 text-blue-500" />
                      <span className="text-sm text-gray-700">Minor</span>
                    </div>
                    <span className="font-semibold text-gray-900">{report.summary.minor_issues}</span>
                  </div>
                </div>
              </div>
              
              {/* Scan Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Scan Details</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Pages Scanned</span>
                    <span className="font-medium">{report.metadata.pages_analyzed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Scan Duration</span>
                    <span className="font-medium">{formatDuration(report.metadata.scan_duration)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Standards</span>
                    <span className="font-medium">WCAG 2.1 AA</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* WCAG Categories */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>WCAG Principles Breakdown</CardTitle>
            <CardDescription>
              Scores by the four core principles of web accessibility
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-6">
              {report.categories.map((category) => (
                <div key={category.name} className="text-center">
                  <h4 className="font-semibold text-gray-900 mb-2">{category.name}</h4>
                  <div className={`text-3xl font-bold mb-2 ${getScoreColor(category.score)}`}>
                    {category.score}%
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{category.violations} issues</p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${getScoreBackground(category.score)}`}
                      style={{ width: `${category.score}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{category.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Issues List */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Accessibility Issues</span>
              <Badge variant="outline">{report.violations.length} total</Badge>
            </CardTitle>
            <CardDescription>
              Issues found during the accessibility scan, ordered by priority
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {visibleViolations.map((violation) => (
                <div key={violation.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getImpactIcon(violation.impact)}
                        <h4 className="font-semibold text-gray-900">{violation.criterion}</h4>
                        <Badge variant="outline" className="text-xs">
                          Level {violation.level}
                        </Badge>
                        <Badge className={getImpactColor(violation.impact)}>
                          {violation.impact}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{violation.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{violation.instances} instances</span>
                        <span>•</span>
                        <span>{violation.page_count} {violation.page_count === 1 ? 'page' : 'pages'}</span>
                        {violation.help_url && (
                          <>
                            <span>•</span>
                            <a 
                              href={violation.help_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              Learn more
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {report.violations.length > 5 && !showAllViolations && (
                <div className="text-center">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAllViolations(true)}
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Show {report.violations.length - 5} more issues
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Recommended Actions
            </CardTitle>
            <CardDescription>
              Prioritized steps to improve accessibility compliance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {report.recommendations.map((rec, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                        <Badge className={getPriorityColor(rec.priority)}>
                          {rec.priority} priority
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{rec.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{rec.estimated_effort}</span>
                        </div>
                        <span>•</span>
                        <span>Addresses: {rec.wcag_references.join(', ')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center p-6 bg-white rounded-lg border border-gray-200">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-gray-900">Powered by EqualShield</span>
          </div>
          <p className="text-sm text-gray-600 max-w-2xl mx-auto">
            This report provides technical guidance for WCAG 2.1 compliance. 
            Automated testing identifies common accessibility barriers but may not catch all issues. 
            Manual review and user testing are recommended for comprehensive accessibility evaluation.
          </p>
          <p className="text-xs text-gray-500 mt-3">
            Generated on {formatDate(report.metadata.generated_at)} • Not legal advice
          </p>
        </div>
      </div>
    </div>
  );
}