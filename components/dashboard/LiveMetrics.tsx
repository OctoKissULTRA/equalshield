'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Server,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Zap
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface LiveMetrics {
  system: {
    scans: {
      total_today: number;
      completed_today: number;
      failed_today: number;
      this_hour: number;
      success_rate: number;
      avg_duration_ms: number;
    };
    system: {
      status: 'healthy' | 'degraded' | 'unknown';
      active_scans: number;
      queue_depth: number;
    };
    trends: Array<{
      hour: string;
      scans: number;
      completed: number;
      failed: number;
    }>;
  };
  organization?: {
    currentPeriod: {
      scansUsed: number;
      pagesUsed: number;
      scansRemaining: number;
      usagePercent: number;
    };
    limits: {
      scansPerMonth: number;
      pagesPerScan: number;
    };
    tier: string;
  };
  activeScans: Array<{
    scanId: string;
    status: string;
    progress: number;
    currentStep: string;
    pagesCrawled: number;
    pagesDiscovered: number;
  }>;
  timestamp: string;
}

interface LiveMetricsProps {
  orgId?: string;
  refreshInterval?: number;
}

export default function LiveMetrics({ orgId, refreshInterval = 30000 }: LiveMetricsProps) {
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    connectToMetrics();

    return () => {
      disconnectFromMetrics();
    };
  }, [orgId]);

  const connectToMetrics = () => {
    try {
      // Close existing connection
      disconnectFromMetrics();

      // Create SSE connection for real-time metrics
      const url = orgId 
        ? `/api/metrics/live?format=sse&orgId=${orgId}`
        : '/api/metrics/live?format=sse';
      
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
        console.log('📊 Connected to live metrics stream');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle ping messages
          if (data.type === 'ping') return;
          
          setMetrics(data);
        } catch (error) {
          console.error('Failed to parse metrics data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('Metrics stream error:', error);
        setIsConnected(false);
        setError('Connection lost');
        
        // Retry connection after 5 seconds
        setTimeout(() => {
          connectToMetrics();
        }, 5000);
      };

    } catch (error) {
      console.error('Failed to connect to metrics stream:', error);
      setIsConnected(false);
      setError('Failed to connect');
    }
  };

  const disconnectFromMetrics = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  };

  const getSystemStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800';
      case 'degraded': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-red-100 text-red-800';
    }
  };

  const getSystemStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4" />;
      default: return <Server className="h-4 w-4" />;
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!metrics) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span>{isConnected ? 'Live metrics' : 'Disconnected'}</span>
        {error && <span className="text-red-600">({error})</span>}
        <span className="text-gray-500 ml-auto">
          Updated {formatTime(metrics.timestamp)}
        </span>
      </div>

      {/* System Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* System Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            {getSystemStatusIcon(metrics.system.system.status)}
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge className={getSystemStatusColor(metrics.system.system.status)}>
                {metrics.system.system.status.charAt(0).toUpperCase() + metrics.system.system.status.slice(1)}
              </Badge>
              <div className="text-xs text-gray-600">
                {metrics.system.system.active_scans} active, {metrics.system.system.queue_depth} queued
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scans Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scans Today</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.system.scans.total_today}</div>
            <div className="text-xs text-gray-600">
              {metrics.system.scans.completed_today} completed, {metrics.system.scans.failed_today} failed
            </div>
            <div className="text-xs text-green-600">
              {metrics.system.scans.success_rate}% success rate
            </div>
          </CardContent>
        </Card>

        {/* This Hour */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Hour</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.system.scans.this_hour}</div>
            <div className="text-xs text-gray-600">
              Avg duration: {formatDuration(metrics.system.scans.avg_duration_ms)}
            </div>
          </CardContent>
        </Card>

        {/* Usage (if org-specific) */}
        {metrics.organization && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usage ({metrics.organization.tier})</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.organization.currentPeriod.scansUsed} / {metrics.organization.limits.scansPerMonth}
              </div>
              <div className="text-xs text-gray-600">
                {metrics.organization.currentPeriod.usagePercent}% used this month
              </div>
              <div className="text-xs text-green-600">
                {metrics.organization.currentPeriod.scansRemaining} remaining
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Active Scans */}
      {metrics.activeScans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Active Scans ({metrics.activeScans.length})
            </CardTitle>
            <CardDescription>
              Real-time scan progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.activeScans.map((scan) => (
                <div key={scan.scanId} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">
                        {scan.scanId.substring(0, 8)}...
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {scan.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {scan.currentStep}
                    </div>
                    <div className="text-xs text-gray-500">
                      {scan.pagesCrawled} / {scan.pagesDiscovered} pages
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{scan.progress}%</div>
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${scan.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 24-Hour Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            24-Hour Scan Trends
          </CardTitle>
          <CardDescription>
            Hourly scan activity and success rates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.system.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="hour" 
                  tickFormatter={(value) => formatTime(value)}
                  interval="preserveStartEnd"
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => formatTime(value as string)}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="scans" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Total Scans"
                />
                <Line 
                  type="monotone" 
                  dataKey="completed" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="Completed"
                />
                <Line 
                  type="monotone" 
                  dataKey="failed" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  name="Failed"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}