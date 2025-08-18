"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader } from './ui/Card';
import { logger } from '@/lib/utils';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error using centralized logger
    logger.error('ErrorBoundary caught an error', {
      component: 'ErrorBoundary',
      action: 'componentDidCatch',
      data: { componentStack: errorInfo.componentStack }
    }, error);
    
    this.setState({
      error,
      errorInfo
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI or default error UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="mx-auto max-w-2xl mt-8">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <div className="text-2xl">⚠️</div>
              <h2 className="text-lg font-semibold text-accent-red">Something went wrong</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-text-muted">
              <p className="mb-2">
                An unexpected error occurred while rendering this component. 
                The error has been logged and our team has been notified.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 p-3 bg-bg-tertiary rounded border">
                  <summary className="cursor-pointer font-medium text-accent-red mb-2">
                    Error Details (Development Only)
                  </summary>
                  <div className="text-sm font-mono space-y-2">
                    <div>
                      <strong>Error:</strong>
                      <pre className="mt-1 overflow-x-auto">{this.state.error.toString()}</pre>
                    </div>
                    {this.state.errorInfo && (
                      <div>
                        <strong>Component Stack:</strong>
                        <pre className="mt-1 overflow-x-auto">{this.state.errorInfo.componentStack}</pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button onClick={this.handleReset} variant="default" size="sm">
                Try Again
              </Button>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline" 
                size="sm"
              >
                Reload Page
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Specialized error boundary for dashboard components
export const DashboardErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => {
  const handleError = (error: Error, errorInfo: ErrorInfo) => {
    // Could send to error reporting service here
    logger.error('Dashboard Error', {
      component: 'DashboardErrorBoundary',
      action: 'handleError',
      data: { componentStack: errorInfo.componentStack }
    }, error);
  };

  return (
    <ErrorBoundary 
      onError={handleError}
      fallback={
        <Card className="mx-auto max-w-lg mt-8">
          <CardContent className="text-center py-8">
            <div className="text-4xl mb-4">🔧</div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Dashboard Temporarily Unavailable
            </h3>
            <p className="text-text-muted mb-4">
              We're experiencing technical difficulties with the dashboard. 
              Please try refreshing the page.
            </p>
            <Button 
              onClick={() => window.location.reload()} 
              variant="default" 
              size="sm"
            >
              Refresh Dashboard
            </Button>
          </CardContent>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  );
};

// Error boundary specifically for event feed
export const EventFeedErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary 
      fallback={
        <div className="text-center py-8 text-accent-red">
          <div className="text-4xl mb-2">⚠️</div>
          <h3 className="font-semibold mb-2">Failed to load event feed</h3>
          <p className="text-sm text-text-muted mb-4">
            There was an error displaying the events. Please try refreshing.
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline" 
            size="sm"
          >
            Refresh
          </Button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
};