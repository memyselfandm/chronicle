'use client';

import React, { memo, useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { getPerformanceMonitor, PerformanceAlert, PerformanceMetrics } from '@/lib/performanceMonitor';
import { useOptimizedRealTime } from '@/lib/storeOptimizations';

interface PerformanceDashboardProps {
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  compact?: boolean;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  status: 'healthy' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
  description?: string;
}

const MetricCard = memo<MetricCardProps>(({ 
  title, 
  value, 
  unit = '', 
  status, 
  trend, 
  description 
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      case 'stable': return '➡️';
      default: return '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '🚨';
      default: return '❓';
    }
  };

  return (
    <Card className="bg-bg-secondary border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-text-primary">{title}</h4>
          <div className="flex items-center gap-1">
            {trend && (
              <span className="text-xs" title={`Trend: ${trend}`}>
                {getTrendIcon(trend)}
              </span>
            )}
            <span className="text-sm" title={`Status: ${status}`}>
              {getStatusIcon(status)}
            </span>
          </div>
        </div>
        
        <div className="flex items-baseline gap-1 mb-1">
          <span className={cn('text-2xl font-bold', getStatusColor(status))}>
            {typeof value === 'number' ? Math.round(value * 100) / 100 : value}
          </span>
          {unit && <span className="text-sm text-text-muted">{unit}</span>}
        </div>
        
        {description && (
          <p className="text-xs text-text-muted leading-relaxed">{description}</p>
        )}
      </CardContent>
    </Card>
  );
});

MetricCard.displayName = 'MetricCard';

const AlertList = memo<{ alerts: PerformanceAlert[]; compact?: boolean }>(({ 
  alerts, 
  compact = false 
}) => {
  const recentAlerts = alerts.slice(-5); // Show last 5 alerts

  if (recentAlerts.length === 0) {
    return (
      <div className="text-center py-4 text-text-muted">
        <span className="text-2xl">🎉</span>
        <p className="text-sm mt-2">No performance alerts</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recentAlerts.map((alert, index) => (
        <div 
          key={`${alert.timestamp.getTime()}-${index}`}
          className={cn(
            'p-3 rounded-md border',
            alert.type === 'critical' 
              ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' 
              : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
          )}
        >
          <div className="flex items-start gap-2">
            <Badge 
              variant={alert.type === 'critical' ? 'destructive' : 'warning'}
              className="text-xs flex-shrink-0"
            >
              {alert.type}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary">
                {alert.message}
              </p>
              {!compact && (
                <div className="text-xs text-text-muted mt-1 space-y-1">
                  <p>
                    <span className="font-medium">{alert.metric}:</span> {alert.value} 
                    (threshold: {alert.threshold})
                  </p>
                  <p>{alert.timestamp.toLocaleTimeString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

AlertList.displayName = 'AlertList';

export const PerformanceDashboard = memo<PerformanceDashboardProps>(({ 
  className,
  autoRefresh = true,
  refreshInterval = 1000,
  compact = false
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const performanceMonitor = useMemo(() => getPerformanceMonitor(), []);
  const realTimeData = useOptimizedRealTime();

  // Start monitoring when component mounts
  useEffect(() => {
    performanceMonitor.start();
    setIsMonitoring(true);

    return () => {
      if (!autoRefresh) {
        performanceMonitor.stop();
        setIsMonitoring(false);
      }
    };
  }, [performanceMonitor, autoRefresh]);

  // Auto-refresh metrics
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setMetrics(performanceMonitor.getMetrics());
      setAlerts(performanceMonitor.getAlerts());
    }, refreshInterval);

    // Initial load
    setMetrics(performanceMonitor.getMetrics());
    setAlerts(performanceMonitor.getAlerts());

    return () => clearInterval(interval);
  }, [performanceMonitor, autoRefresh, refreshInterval]);

  // Subscribe to alerts
  useEffect(() => {
    const unsubscribe = performanceMonitor.subscribeToAlerts((alert) => {
      setAlerts(prev => [...prev, alert]);
    });

    return unsubscribe;
  }, [performanceMonitor]);

  if (!metrics) {
    return (
      <div className={cn('p-4 text-center', className)}>
        <div className="text-text-muted">
          <span className="text-2xl">⏳</span>
          <p className="text-sm mt-2">Loading performance metrics...</p>
        </div>
      </div>
    );
  }

  const summary = performanceMonitor.getPerformanceSummary();

  const getFrameRateStatus = (fps: number) => {
    if (fps >= 55) return 'healthy';
    if (fps >= 30) return 'warning';
    return 'critical';
  };

  const getMemoryStatus = (percentage: number) => {
    if (percentage < 70) return 'healthy';
    if (percentage < 85) return 'warning';
    return 'critical';
  };

  const getRenderTimeStatus = (ms: number) => {
    if (ms < 16) return 'healthy';
    if (ms < 33) return 'warning';
    return 'critical';
  };

  const getThroughputStatus = (eps: number) => {
    if (eps < 100) return 'healthy';
    if (eps < 200) return 'warning';
    return 'critical';
  };

  if (compact) {
    return (
      <Card className={cn('bg-bg-primary border-border', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Performance</h3>
            <Badge 
              variant={summary.status === 'healthy' ? 'success' : 
                      summary.status === 'warning' ? 'warning' : 'destructive'}
              className="text-xs"
            >
              {summary.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-text-muted">FPS:</span>{' '}
              <span className={cn(getFrameRateStatus(summary.frameRate) === 'healthy' ? 'text-green-500' : 'text-yellow-500')}>
                {summary.frameRate}
              </span>
            </div>
            <div>
              <span className="text-text-muted">Memory:</span>{' '}
              <span className={cn(getMemoryStatus(summary.memoryUsage) === 'healthy' ? 'text-green-500' : 'text-yellow-500')}>
                {summary.memoryUsage}%
              </span>
            </div>
            <div>
              <span className="text-text-muted">Render:</span>{' '}
              <span className={cn(getRenderTimeStatus(summary.averageRenderTime) === 'healthy' ? 'text-green-500' : 'text-yellow-500')}>
                {summary.averageRenderTime}ms
              </span>
            </div>
            <div>
              <span className="text-text-muted">Events:</span>{' '}
              <span className={cn(getThroughputStatus(summary.eventThroughput) === 'healthy' ? 'text-green-500' : 'text-yellow-500')}>
                {summary.eventThroughput}/s
              </span>
            </div>
          </div>
          
          {(summary.criticalAlerts > 0 || summary.warningAlerts > 0) && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Alerts:</span>
                <div className="flex gap-2">
                  {summary.criticalAlerts > 0 && (
                    <span className="text-red-500">🚨 {summary.criticalAlerts}</span>
                  )}
                  {summary.warningAlerts > 0 && (
                    <span className="text-yellow-500">⚠️ {summary.warningAlerts}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Performance Dashboard</h2>
        <div className="flex items-center gap-2">
          <Badge 
            variant={summary.status === 'healthy' ? 'success' : 
                    summary.status === 'warning' ? 'warning' : 'destructive'}
            className="text-sm"
          >
            {summary.status}
          </Badge>
          {isMonitoring && (
            <div className="flex items-center gap-1 text-xs text-text-muted">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Monitoring
            </div>
          )}
        </div>
      </div>

      {/* Core Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Frame Rate"
          value={summary.frameRate}
          unit="fps"
          status={getFrameRateStatus(summary.frameRate)}
          description="Target: 60fps for smooth experience"
        />
        
        <MetricCard
          title="Memory Usage"
          value={summary.memoryUsage}
          unit="%"
          status={getMemoryStatus(summary.memoryUsage)}
          description="JavaScript heap usage percentage"
        />
        
        <MetricCard
          title="Render Time"
          value={summary.averageRenderTime}
          unit="ms"
          status={getRenderTimeStatus(summary.averageRenderTime)}
          description="Average component render time"
        />
        
        <MetricCard
          title="Event Throughput"
          value={summary.eventThroughput}
          unit="/s"
          status={getThroughputStatus(summary.eventThroughput)}
          description="Events processed per second"
        />
      </div>

      {/* Real-time Metrics */}
      <Card className="bg-bg-secondary border-border">
        <CardHeader>
          <h3 className="text-md font-semibold text-text-primary">Real-time Performance</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-2">Connection</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Status:</span>
                  <Badge 
                    variant={realTimeData.connectionStatus === 'connected' ? 'success' : 'warning'}
                    className="text-xs"
                  >
                    {realTimeData.connectionStatus}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Enabled:</span>
                  <span className="text-text-primary">{realTimeData.isEnabled ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-2">Components</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Tracked:</span>
                  <span className="text-text-primary">{summary.componentCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Optimized:</span>
                  <span className="text-green-500">Yes</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-2">Virtual Scrolling</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Active:</span>
                  <span className="text-green-500">Yes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Item Height:</span>
                  <span className="text-text-primary">32px</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card className="bg-bg-secondary border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-md font-semibold text-text-primary">Performance Alerts</h3>
            {alerts.length > 0 && (
              <button
                onClick={() => performanceMonitor.clearAlerts()}
                className="text-xs text-accent-blue hover:text-accent-blue/80 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <AlertList alerts={alerts} />
        </CardContent>
      </Card>
    </div>
  );
});

PerformanceDashboard.displayName = 'PerformanceDashboard';