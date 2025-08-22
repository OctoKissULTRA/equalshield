'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Share2, 
  Copy, 
  Trash2, 
  Eye, 
  Calendar, 
  Clock,
  ExternalLink,
  Plus,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';

interface ShareToken {
  id: string;
  scanId: string;
  scanUrl: string;
  scanDate: string;
  expiresAt: string;
  revokedAt?: string;
  maxViews: number;
  views: number;
  createdAt: string;
  isActive: boolean;
  viewsRemaining: number;
}

interface ShareManagerProps {
  scanId: string;
  scanUrl: string;
  orgId: string;
}

export default function ShareManager({ scanId, scanUrl, orgId }: ShareManagerProps) {
  const [shareTokens, setShareTokens] = useState<ShareToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTokenParams, setNewTokenParams] = useState({
    ttlDays: 7,
    maxViews: 50
  });
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchShareTokens();
  }, [orgId]);

  const fetchShareTokens = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/reports/share?orgId=${orgId}`);
      if (response.ok) {
        const data = await response.json();
        setShareTokens(data.tokens || []);
      }
    } catch (error) {
      console.error('Failed to fetch share tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const createShareToken = async () => {
    setCreating(true);
    try {
      const response = await fetch('/api/reports/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scanId,
          ttlDays: newTokenParams.ttlDays,
          maxViews: newTokenParams.maxViews
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setShowCreateDialog(false);
        
        // Copy the new URL to clipboard
        await copyToClipboard(data.fullUrl);
        
        // Refresh the list
        fetchShareTokens();
        
        // Reset form
        setNewTokenParams({ ttlDays: 7, maxViews: 50 });
      } else {
        const error = await response.json();
        alert(`Failed to create share link: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to create share token:', error);
      alert('Failed to create share link');
    } finally {
      setCreating(false);
    }
  };

  const revokeShareToken = async (tokenId: string) => {
    if (!confirm('Are you sure you want to revoke this share link? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/reports/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tokenId }),
      });

      if (response.ok) {
        fetchShareTokens(); // Refresh the list
      } else {
        const error = await response.json();
        alert(`Failed to revoke share link: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to revoke share token:', error);
      alert('Failed to revoke share link');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(text);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const generateShareUrl = (tokenId: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    return `${baseUrl}/r/${tokenId}`;
  };

  const getStatusIcon = (token: ShareToken) => {
    if (token.revokedAt) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    if (new Date(token.expiresAt) < new Date()) {
      return <Clock className="h-4 w-4 text-gray-500" />;
    }
    if (token.views >= token.maxViews) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = (token: ShareToken) => {
    if (token.revokedAt) return 'Revoked';
    if (new Date(token.expiresAt) < new Date()) return 'Expired';
    if (token.views >= token.maxViews) return 'View Limit Reached';
    return 'Active';
  };

  const getStatusColor = (token: ShareToken) => {
    if (token.revokedAt) return 'bg-red-100 text-red-800';
    if (new Date(token.expiresAt) < new Date()) return 'bg-gray-100 text-gray-800';
    if (token.views >= token.maxViews) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const currentScanTokens = shareTokens.filter(token => token.scanId === scanId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Report
            </CardTitle>
            <CardDescription>
              Create secure, time-limited links to share this accessibility report
            </CardDescription>
          </div>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Share Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Shareable Link</DialogTitle>
                <DialogDescription>
                  Generate a secure link to share this accessibility report with others
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ttl">Expires After</Label>
                  <Select 
                    value={newTokenParams.ttlDays.toString()} 
                    onValueChange={(value) => setNewTokenParams(prev => ({ ...prev, ttlDays: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Day</SelectItem>
                      <SelectItem value="3">3 Days</SelectItem>
                      <SelectItem value="7">1 Week</SelectItem>
                      <SelectItem value="14">2 Weeks</SelectItem>
                      <SelectItem value="30">1 Month</SelectItem>
                      <SelectItem value="90">3 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="maxViews">Maximum Views</Label>
                  <Select 
                    value={newTokenParams.maxViews.toString()} 
                    onValueChange={(value) => setNewTokenParams(prev => ({ ...prev, maxViews: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 View</SelectItem>
                      <SelectItem value="5">5 Views</SelectItem>
                      <SelectItem value="10">10 Views</SelectItem>
                      <SelectItem value="25">25 Views</SelectItem>
                      <SelectItem value="50">50 Views</SelectItem>
                      <SelectItem value="100">100 Views</SelectItem>
                      <SelectItem value="250">250 Views</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Security:</strong> Share links are cryptographically secure and can be revoked at any time. 
                    Shared reports include a watermark and usage tracking.
                  </p>
                </div>
                
                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCreateDialog(false)}
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={createShareToken}
                    disabled={creating}
                    className="flex items-center gap-2"
                  >
                    {creating ? (
                      <>
                        <Clock className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Share2 className="h-4 w-4" />
                        Create Link
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <Clock className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-600">Loading share links...</p>
          </div>
        ) : currentScanTokens.length === 0 ? (
          <div className="text-center py-8">
            <Share2 className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">No share links created yet</p>
            <p className="text-sm text-gray-500">
              Create a share link to allow others to view this report without an account
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentScanTokens.map((token) => (
              <div key={token.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(token)}
                      <Badge className={getStatusColor(token)}>
                        {getStatusText(token)}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        Created {formatDate(token.createdAt)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-600">Expires:</span>{' '}
                        <span className="font-medium">{formatDate(token.expiresAt)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Views:</span>{' '}
                        <span className="font-medium">{token.views} / {token.maxViews}</span>
                      </div>
                    </div>
                    
                    {token.isActive && (
                      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded font-mono text-sm">
                        <span className="truncate flex-1">{generateShareUrl(token.id)}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(generateShareUrl(token.id))}
                          className="flex items-center gap-1"
                        >
                          {copySuccess === generateShareUrl(token.id) ? (
                            <>
                              <CheckCircle className="h-3 w-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {token.isActive && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(generateShareUrl(token.id), '_blank')}
                          className="flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revokeShareToken(token.id)}
                          className="flex items-center gap-1 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                          Revoke
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}