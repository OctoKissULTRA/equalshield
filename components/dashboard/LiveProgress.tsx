'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  Globe, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Play,
  Pause,
  RefreshCw
} from 'lucide-react';

interface ScanProgress {
  scanId: string;
  status: 'queued' | 'starting' | 'crawling' | 'analyzing' | 'generating_report' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  startTime: string;
  estimatedCompletion?: string;
  pagesDiscovered: number;
  pagesCrawled: number;
  currentPage?: string;
  errors: Array<{
    page: string;
    error: string;
    timestamp: string;
  }>;
  metadata?: {
    totalViolations?: number;
    criticalIssues?: number;
    quickWins?: number;
    overallScore?: number;
  };
}

interface LiveProgressProps {
  scanId: string;
  onComplete?: (results: any) => void;
  onError?: (error: string) => void;
}

export default function LiveProgress({ scanId, onComplete, onError }: LiveProgressProps) {
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!scanId || isPaused) return;

    connectToProgress();

    return () => {
      disconnectFromProgress();
    };
  }, [scanId, isPaused]);

  const connectToProgress = () => {
    try {
      // Close existing connection
      disconnectFromProgress();

      // Create new Server-Sent Events connection
      const eventSource = new EventSource(`/api/progress/${scanId}?format=sse`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        console.log(`📡 Connected to progress stream for scan ${scanId}`);
      };

      eventSource.onmessage = (event) => {
        try {
          const progressData: ScanProgress = JSON.parse(event.data);
          setProgress(progressData);

          // Handle completion
          if (progressData.status === 'completed' && onComplete) {
            onComplete(progressData.metadata);
          }

          // Handle errors
          if (progressData.status === 'failed' && onError) {
            const lastError = progressData.errors[progressData.errors.length - 1];
            onError(lastError?.error || 'Scan failed');
          }

        } catch (error) {
          console.error('Failed to parse progress data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('Progress stream error:', error);
        setIsConnected(false);
        
        // Retry connection after 3 seconds
        setTimeout(() => {
          if (!isPaused) {
            connectToProgress();
          }
        }, 3000);
      };

    } catch (error) {
      console.error('Failed to connect to progress stream:', error);
      setIsConnected(false);
    }
  };

  const disconnectFromProgress = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  };

  const toggleConnection = () => {
    setIsPaused(!isPaused);
  };

  const refreshProgress = async () => {
    try {
      const response = await fetch(`/api/progress/${scanId}`);
      if (response.ok) {
        const progressData = await response.json();
        setProgress(progressData);
      }
    } catch (error) {
      console.error('Failed to refresh progress:', error);
    }
  };

  const getStatusIcon = (status: ScanProgress['status']) => {
    switch (status) {
      case 'queued':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'starting':
      case 'crawling':
      case 'analyzing':
      case 'generating_report':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: ScanProgress['status']) => {
    switch (status) {
      case 'queued': return 'bg-blue-100 text-blue-800';
      case 'starting':
      case 'crawling':
      case 'analyzing':
      case 'generating_report': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(diffSeconds / 60);
    const seconds = diffSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatEstimatedCompletion = (estimatedCompletion: string) => {
    const estimated = new Date(estimatedCompletion);
    const now = new Date();
    const diffMs = estimated.getTime() - now.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    
    if (diffSeconds <= 0) return 'Any moment now';
    if (diffSeconds < 60) return `~${diffSeconds}s remaining`;
    
    const minutes = Math.floor(diffSeconds / 60);
    return `~${minutes}m remaining`;
  };

  if (!progress) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading scan progress...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(progress.status)}
            <CardTitle className="text-lg">
              Scan Progress
            </CardTitle>
            <Badge className={getStatusColor(progress.status)}>
              {progress.status.charAt(0).toUpperCase() + progress.status.slice(1)}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Connection indicator */}
            <div className="flex items-center gap-1 text-xs">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              {isConnected ? 'Live' : 'Disconnected'}
            </div>
            
            {/* Controls */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleConnection}
              disabled={progress.status === 'completed' || progress.status === 'failed'}
            >
              {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={refreshProgress}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        <CardDescription>
          Scan ID: {progress.scanId}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{progress.currentStep}</span>
            <span>{progress.progress}%</span>
          </div>
          <Progress value={progress.progress} className="w-full" />
        </div>

        {/* Timing Information */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Duration</p>
            <p className="font-medium">{formatDuration(progress.startTime)}</p>
          </div>
          {progress.estimatedCompletion && (
            <div>
              <p className="text-gray-600">Estimated completion</p>
              <p className="font-medium">{formatEstimatedCompletion(progress.estimatedCompletion)}</p>
            </div>
          )}
        </div>

        {/* Page Progress */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Pages discovered</p>
            <p className="font-medium">{progress.pagesDiscovered}</p>
          </div>
          <div>
            <p className="text-gray-600">Pages crawled</p>
            <p className="font-medium">{progress.pagesCrawled}</p>
          </div>
        </div>

        {/* Current Page */}
        {progress.currentPage && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <Globe className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-blue-900">Currently scanning</p>
                <p className="text-xs text-blue-700 truncate">{progress.currentPage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results Preview (if available) */}
        {progress.metadata && (
          <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg text-sm">
            {progress.metadata.totalViolations !== undefined && (
              <div>
                <p className="text-gray-600">Violations found</p>
                <p className="font-medium">{progress.metadata.totalViolations}</p>
              </div>
            )}
            {progress.metadata.criticalIssues !== undefined && (
              <div>
                <p className="text-gray-600">Critical issues</p>
                <p className="font-medium text-red-600">{progress.metadata.criticalIssues}</p>
              </div>
            )}
            {progress.metadata.quickWins !== undefined && (
              <div>
                <p className="text-gray-600">Quick wins</p>
                <p className="font-medium text-green-600">{progress.metadata.quickWins}</p>
              </div>
            )}
            {progress.metadata.overallScore !== undefined && (
              <div>
                <p className="text-gray-600">Overall score</p>
                <p className="font-medium">{progress.metadata.overallScore}/100</p>
              </div>
            )}
          </div>
        )}

        {/* Errors */}
        {progress.errors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-sm font-medium text-red-600">
              <AlertCircle className="h-4 w-4" />
              Issues encountered ({progress.errors.length})
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {progress.errors.slice(-3).map((error, index) => (
                <div key={index} className="p-2 bg-red-50 border border-red-200 rounded text-xs">
                  <p className="font-medium text-red-900 truncate">{error.page}</p>
                  <p className="text-red-700">{error.error}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}