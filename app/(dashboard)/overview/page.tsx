'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LiveMetrics from '@/components/dashboard/LiveMetrics';
import LiveProgress from '@/components/dashboard/LiveProgress';
import { 
  BarChart3, 
  Activity, 
  TrendingUp, 
  Zap, 
  Users, 
  Globe,
  Plus,
  ExternalLink
} from 'lucide-react';

interface RecentScan {
  id: string;
  url: string;
  status: 'completed' | 'failed' | 'in_progress';
  score?: number;
  violations?: number;
  created_at: string;
  updated_at: string;
}

export default function OverviewPage() {
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentScans();
  }, []);

  const fetchRecentScans = async () => {
    try {
      // TODO: Replace with actual API call
      const mockScans: RecentScan[] = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          url: 'https://example.com',
          status: 'completed',
          score: 87,
          violations: 12,
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 90 * 60 * 1000).toISOString()
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          url: 'https://mysite.org',
          status: 'in_progress',
          created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString()
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          url: 'https://webapp.io',
          status: 'failed',
          created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString()
        }
      ];
      
      setRecentScans(mockScans);
    } catch (error) {
      console.error('Failed to fetch recent scans:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: RecentScan['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const startNewScan = () => {
    // TODO: Navigate to scan creation or open modal
    window.location.href = '/scan';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Monitor accessibility scans and system performance
          </p>
        </div>
        <Button onClick={startNewScan} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Scan
        </Button>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Live Metrics
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Recent Activity
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
                <Globe className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">127</div>
                <p className="text-xs text-green-600">+12% from last month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">84.2</div>
                <p className="text-xs text-green-600">+3.1 points</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Issues Fixed</CardTitle>
                <Zap className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">348</div>
                <p className="text-xs text-green-600">+23% this week</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Scans</CardTitle>
                <Activity className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3</div>
                <p className="text-xs text-gray-600">Currently running</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Scans */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Scans
              </CardTitle>
              <CardDescription>
                Your latest accessibility scans and their results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {recentScans.map((scan) => (
                    <div key={scan.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Globe className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{scan.url}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>{formatRelativeTime(scan.created_at)}</span>
                            {scan.score && (
                              <>
                                <span>•</span>
                                <span>Score: {scan.score}/100</span>
                              </>
                            )}
                            {scan.violations && (
                              <>
                                <span>•</span>
                                <span>{scan.violations} issues</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(scan.status)}
                        {scan.status === 'in_progress' ? (
                          <Button variant="outline" size="sm">
                            View Progress
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View Report
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Scans Progress */}
          {recentScans.some(scan => scan.status === 'in_progress') && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Active Scans</h2>
              {recentScans
                .filter(scan => scan.status === 'in_progress')
                .map(scan => (
                  <LiveProgress 
                    key={scan.id}
                    scanId={scan.id}
                    onComplete={(results) => {
                      console.log('Scan completed:', results);
                      fetchRecentScans(); // Refresh the list
                    }}
                    onError={(error) => {
                      console.error('Scan failed:', error);
                      fetchRecentScans(); // Refresh the list
                    }}
                  />
                ))
              }
            </div>
          )}
        </TabsContent>

        {/* Live Metrics Tab */}
        <TabsContent value="metrics" className="space-y-6">
          <LiveMetrics refreshInterval={15000} />
        </TabsContent>

        {/* Recent Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity Feed</CardTitle>
              <CardDescription>
                Real-time updates on scans, reports, and system events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 border-l-4 border-blue-500 bg-blue-50">
                  <Activity className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Scan completed</p>
                    <p className="text-sm text-gray-600">example.com - Score: 87/100 (12 issues found)</p>
                    <p className="text-xs text-gray-500">2 hours ago</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 border-l-4 border-green-500 bg-green-50">
                  <Zap className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">PDF report generated</p>
                    <p className="text-sm text-gray-600">mysite.org accessibility report ready for download</p>
                    <p className="text-xs text-gray-500">4 hours ago</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 border-l-4 border-yellow-500 bg-yellow-50">
                  <Users className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Usage limit warning</p>
                    <p className="text-sm text-gray-600">You've used 80% of your monthly scan quota</p>
                    <p className="text-xs text-gray-500">1 day ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}