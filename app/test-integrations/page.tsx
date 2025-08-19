'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TestResult {
  status: 'not_tested' | 'success' | 'error';
  data: any;
  error: string | null;
}

interface TestResults {
  supabase: TestResult;
  stripe: TestResult;
  openai: TestResult;
}

export default function TestIntegrationsPage() {
  const [results, setResults] = useState<TestResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [timestamp, setTimestamp] = useState<string>('');

  const runTests = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-integrations');
      const data = await response.json();
      setResults(data.results);
      setTimestamp(data.timestamp);
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50';
      case 'error': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🧪 EqualShield Integration Tests
          </h1>
          <p className="text-gray-600 mb-6">
            Test all third-party integrations: Supabase, Stripe, and OpenAI
          </p>
          <Button 
            onClick={runTests} 
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? '🔄 Running Tests...' : '🚀 Run All Tests'}
          </Button>
          {timestamp && (
            <p className="text-sm text-gray-500 mt-2">
              Last tested: {new Date(timestamp).toLocaleString()}
            </p>
          )}
        </div>

        {results && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Supabase Test */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getStatusIcon(results.supabase.status)}
                  Supabase Database
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`px-3 py-2 rounded-lg text-sm font-medium mb-3 ${getStatusColor(results.supabase.status)}`}>
                  Status: {results.supabase.status.toUpperCase()}
                </div>
                
                {results.supabase.error && (
                  <div className="text-red-600 text-sm mb-2">
                    <strong>Error:</strong> {results.supabase.error}
                  </div>
                )}
                
                {results.supabase.data && (
                  <div className="text-green-600 text-sm">
                    <strong>Data:</strong> {JSON.stringify(results.supabase.data, null, 2)}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stripe Test */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getStatusIcon(results.stripe.status)}
                  Stripe Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`px-3 py-2 rounded-lg text-sm font-medium mb-3 ${getStatusColor(results.stripe.status)}`}>
                  Status: {results.stripe.status.toUpperCase()}
                </div>
                
                {results.stripe.error && (
                  <div className="text-red-600 text-sm mb-2">
                    <strong>Error:</strong> {results.stripe.error}
                  </div>
                )}
                
                {results.stripe.data && (
                  <div className="text-green-600 text-sm">
                    <strong>Prices Found:</strong> {results.stripe.data.price_count}
                    {results.stripe.data.prices && results.stripe.data.prices.length > 0 && (
                      <pre className="mt-2 bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                        {JSON.stringify(results.stripe.data.prices, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* OpenAI Test */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getStatusIcon(results.openai.status)}
                  OpenAI GPT-5
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`px-3 py-2 rounded-lg text-sm font-medium mb-3 ${getStatusColor(results.openai.status)}`}>
                  Status: {results.openai.status.toUpperCase()}
                </div>
                
                {results.openai.error && (
                  <div className="text-red-600 text-sm mb-2">
                    <strong>Error:</strong> {results.openai.error}
                  </div>
                )}
                
                {results.openai.data && (
                  <div className="text-green-600 text-sm">
                    <strong>Model:</strong> {results.openai.data.model_used}<br/>
                    <strong>Response:</strong> {results.openai.data.response}<br/>
                    <strong>Tokens Used:</strong> {results.openai.data.usage?.total_tokens}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {!results && !loading && (
          <div className="text-center text-gray-500 mt-8">
            Click "Run All Tests" to check your integrations
          </div>
        )}
      </div>
    </div>
  );
}