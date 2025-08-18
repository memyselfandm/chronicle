"use client";

import { useState, useEffect } from 'react';
import { ProductionEventDashboard } from './ProductionEventDashboard';
import { EventDashboard } from './EventDashboard';
import { Card, CardContent, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { supabase } from '@/lib/supabase';
import type { ConnectionState } from '@/types/connection';

export const DashboardWithFallback: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [useDemoMode, setUseDemoMode] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Test connection to Supabase
        const { error } = await supabase
          .from('chronicle_sessions')
          .select('id')
          .limit(1);

        if (error) {
          // Check if it's a CORS/network error
          if (error.message?.includes('Failed to fetch') || 
              error.message?.includes('CORS') ||
              error.message?.includes('NetworkError')) {
            setConnectionState('error');
            setErrorMessage('Cannot connect to Supabase backend. The service appears to be down or unreachable.');
          } else if (error.code === 'PGRST116') {
            // No rows found is OK - database is empty but connected
            setConnectionState('connected');
          } else {
            setConnectionState('error');
            setErrorMessage(`Database error: ${error.message}`);
          }
        } else {
          setConnectionState('connected');
        }
      } catch (err) {
        setConnectionState('error');
        setErrorMessage(err instanceof Error ? err.message : 'Unknown error connecting to Supabase');
      }
    };

    checkConnection();
  }, []);

  // If user explicitly chooses demo mode, show it
  if (useDemoMode) {
    return (
      <div className="w-full max-w-6xl mx-auto p-6">
        <Card className="mb-4 border-accent-yellow bg-accent-yellow/10">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-accent-yellow">⚠️</span>
                <span className="text-sm text-text-primary">
                  Running in demo mode. Real-time data is not available.
                </span>
              </div>
              <Button
                onClick={() => {
                  setUseDemoMode(false);
                  setConnectionState('checking');
                }}
                variant="outline"
                size="sm"
              >
                Try Production Mode
              </Button>
            </div>
          </CardContent>
        </Card>
        <EventDashboard />
      </div>
    );
  }

  // Show loading state
  if (connectionState === 'checking') {
    return (
      <div className="w-full max-w-6xl mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mb-4"></div>
            <p className="text-text-muted">Connecting to Supabase...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state with option to use demo mode
  if (connectionState === 'error') {
    return (
      <div className="w-full max-w-6xl mx-auto p-6">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-accent-red">Connection Error</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-bg-secondary rounded-lg p-4 border border-border-muted">
              <p className="text-text-primary mb-2">
                {errorMessage}
              </p>
              <p className="text-sm text-text-muted">
                This typically happens when:
              </p>
              <ul className="text-sm text-text-muted list-disc list-inside mt-2 space-y-1">
                <li>The Supabase service is down or not running</li>
                <li>The URL in .env.development is incorrect</li>
                <li>CORS is not configured for localhost:3000</li>
                <li>Network connectivity issues</li>
              </ul>
            </div>

            <div className="bg-bg-secondary rounded-lg p-4 border border-border-muted">
              <p className="text-sm text-text-muted mb-2">
                <strong>Supabase URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not configured'}
              </p>
              <p className="text-sm text-text-muted">
                If this is a local/self-hosted Supabase instance, ensure it's running and accessible.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => window.location.reload()}
                variant="primary"
              >
                Retry Connection
              </Button>
              <Button
                onClick={() => setUseDemoMode(true)}
                variant="outline"
              >
                Use Demo Mode
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Connected - show production dashboard
  return <ProductionEventDashboard />;
};