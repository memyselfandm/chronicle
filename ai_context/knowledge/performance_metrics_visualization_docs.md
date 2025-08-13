# Performance Metrics Visualization Documentation

## Overview
This document outlines visualization patterns and techniques for performance metrics in observability dashboards, focusing on response time trends, percentile analysis, and comparative analytics for the Chronicle MVP dashboard.

## Core Performance Metrics

### Response Time Metrics
Primary metrics for measuring system performance and user experience.

#### Key Metrics
- **Mean/Average Response Time**: Basic performance indicator
- **Median (P50)**: Middle value representing typical user experience
- **P95 Percentile**: 95% of requests complete within this time
- **P99 Percentile**: 99% of requests complete within this time (tail latency)
- **P99.9 Percentile**: Extreme outlier detection

#### Color Coding Standards
```javascript
const PERFORMANCE_COLORS = {
  excellent: '#10B981',  // Green - < 100ms
  good: '#3B82F6',       // Blue - 100-300ms
  acceptable: '#F59E0B', // Amber - 300-1000ms
  poor: '#EF4444',       // Red - > 1000ms
  critical: '#7C2D12'    // Dark Red - > 5000ms
};

const getPerformanceColor = (responseTime) => {
  if (responseTime < 100) return PERFORMANCE_COLORS.excellent;
  if (responseTime < 300) return PERFORMANCE_COLORS.good;
  if (responseTime < 1000) return PERFORMANCE_COLORS.acceptable;
  if (responseTime < 5000) return PERFORMANCE_COLORS.poor;
  return PERFORMANCE_COLORS.critical;
};
```

### Tool Execution Performance
Specific metrics for Chronicle's tool execution monitoring.

#### Tool Categories
```javascript
const TOOL_PERFORMANCE_BASELINES = {
  'Read': { baseline: 50, warning: 200, critical: 500 },
  'Edit': { baseline: 100, warning: 500, critical: 1000 },
  'Bash': { baseline: 200, warning: 2000, critical: 10000 },
  'Grep': { baseline: 150, warning: 1000, critical: 3000 },
  'Write': { baseline: 80, warning: 300, critical: 800 },
  'WebSearch': { baseline: 1000, warning: 5000, critical: 15000 },
  'MCP Tools': { baseline: 300, warning: 1500, critical: 5000 }
};
```

## Visualization Patterns

### Time Series Line Charts
Display response time trends over time with multiple percentiles.

```jsx
const ResponseTimeTrendChart = ({ data, timeRange, selectedTools }) => {
  const processedData = useMemo(() => {
    return data.map(point => ({
      timestamp: point.timestamp,
      p50: point.percentiles.p50,
      p95: point.percentiles.p95,
      p99: point.percentiles.p99,
      mean: point.mean,
      toolType: point.toolType,
      sessionId: point.sessionId
    }));
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={processedData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis 
          dataKey="timestamp"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(value) => new Date(value).toLocaleTimeString()}
          stroke="#9CA3AF"
        />
        <YAxis 
          label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft' }}
          stroke="#9CA3AF"
        />
        <Tooltip content={<PerformanceTooltip />} />
        <Legend />
        
        {/* P50 - Median performance */}
        <Line 
          type="monotone" 
          dataKey="p50" 
          stroke="#10B981"
          strokeWidth={2}
          dot={false}
          name="P50 (Median)"
        />
        
        {/* P95 - Good user experience threshold */}
        <Line 
          type="monotone" 
          dataKey="p95" 
          stroke="#3B82F6"
          strokeWidth={2}
          dot={false}
          name="P95"
        />
        
        {/* P99 - Tail latency detection */}
        <Line 
          type="monotone" 
          dataKey="p99" 
          stroke="#F59E0B"
          strokeWidth={2}
          dot={false}
          name="P99 (Tail Latency)"
        />
        
        {/* Mean for comparison */}
        <Line 
          type="monotone" 
          dataKey="mean" 
          stroke="#6B7280"
          strokeWidth={1}
          strokeDasharray="5 5"
          dot={false}
          name="Mean"
        />
        
        {/* Performance threshold lines */}
        <ReferenceLine 
          y={1000} 
          stroke="#EF4444" 
          strokeDasharray="3 3"
          label="SLA Threshold"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
```

### Performance Distribution Heatmap
Visualize performance distribution across different time periods and tools.

```jsx
const PerformanceHeatmap = ({ data, granularity = 'hour' }) => {
  const heatmapData = useMemo(() => {
    const buckets = {};
    
    data.forEach(event => {
      const timeKey = getTimeBucket(event.timestamp, granularity);
      const toolType = event.toolType;
      const key = `${timeKey}-${toolType}`;
      
      if (!buckets[key]) {
        buckets[key] = {
          time: timeKey,
          tool: toolType,
          count: 0,
          totalTime: 0,
          p95: 0
        };
      }
      
      buckets[key].count++;
      buckets[key].totalTime += event.executionTime;
      buckets[key].p95 = calculateP95(buckets[key].samples || []);
    });
    
    return Object.values(buckets);
  }, [data, granularity]);

  return (
    <div className="performance-heatmap">
      {TOOL_TYPES.map(tool => (
        <div key={tool} className="heatmap-row">
          <div className="tool-label">{tool}</div>
          {TIME_BUCKETS.map(timeBucket => {
            const dataPoint = heatmapData.find(
              d => d.time === timeBucket && d.tool === tool
            );
            const intensity = getPerformanceIntensity(dataPoint?.p95 || 0);
            
            return (
              <div
                key={`${tool}-${timeBucket}`}
                className="heatmap-cell"
                style={{ backgroundColor: intensity.color }}
                title={`${tool} at ${timeBucket}: ${dataPoint?.p95 || 0}ms P95`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};
```

### Performance Score Gauges
Display current performance status with visual indicators.

```jsx
const PerformanceScoreGauge = ({ currentP95, baseline, warning, critical }) => {
  const getScoreColor = (value) => {
    if (value <= baseline) return '#10B981';
    if (value <= warning) return '#F59E0B';
    return '#EF4444';
  };

  const score = Math.max(0, 100 - ((currentP95 - baseline) / baseline) * 100);
  
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={[
            { name: 'Score', value: score },
            { name: 'Remaining', value: 100 - score }
          ]}
          cx="50%"
          cy="50%"
          startAngle={180}
          endAngle={0}
          innerRadius={60}
          outerRadius={80}
          paddingAngle={0}
          dataKey="value"
        >
          <Cell fill={getScoreColor(currentP95)} />
          <Cell fill="#374151" />
        </Pie>
        <text 
          x="50%" 
          y="50%" 
          textAnchor="middle" 
          dominantBaseline="middle" 
          className="fill-current text-2xl font-bold text-white"
        >
          {Math.round(score)}
        </text>
        <text 
          x="50%" 
          y="60%" 
          textAnchor="middle" 
          dominantBaseline="middle" 
          className="fill-current text-sm text-gray-400"
        >
          Performance Score
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
};
```

## Comparative Analytics

### Tool Performance Comparison
Compare performance across different tool types and time periods.

```jsx
const ToolPerformanceComparison = ({ data, comparisonPeriods }) => {
  const comparisonData = useMemo(() => {
    return TOOL_TYPES.map(tool => {
      const toolData = data.filter(d => d.toolType === tool);
      
      return {
        tool,
        current: calculatePercentiles(toolData.filter(d => isCurrentPeriod(d.timestamp))),
        previous: calculatePercentiles(toolData.filter(d => isPreviousPeriod(d.timestamp))),
        baseline: TOOL_PERFORMANCE_BASELINES[tool]
      };
    });
  }, [data]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {comparisonData.map(({ tool, current, previous, baseline }) => (
        <div key={tool} className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-3">{tool}</h3>
          
          {/* Current vs Previous Performance */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">P95 Current</span>
              <span className={`text-sm font-medium ${
                current.p95 <= baseline.baseline ? 'text-green-400' : 
                current.p95 <= baseline.warning ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {current.p95}ms
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">P95 Previous</span>
              <span className="text-sm text-gray-300">{previous.p95}ms</span>
            </div>
            
            {/* Performance Change Indicator */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Change</span>
              <PerformanceChangeIndicator 
                current={current.p95} 
                previous={previous.p95} 
              />
            </div>
          </div>
          
          {/* Mini Performance Trend */}
          <div className="mt-3 h-16">
            <MiniPerformanceTrend data={toolData} />
          </div>
        </div>
      ))}
    </div>
  );
};
```

### Session Performance Analytics
Analyze performance patterns across user sessions.

```jsx
const SessionPerformanceAnalytics = ({ sessionData }) => {
  const sessionMetrics = useMemo(() => {
    return sessionData.map(session => ({
      sessionId: session.id,
      duration: session.endTime - session.startTime,
      toolCount: session.events.length,
      avgResponseTime: calculateMean(session.events.map(e => e.executionTime)),
      p95ResponseTime: calculateP95(session.events.map(e => e.executionTime)),
      errorRate: session.events.filter(e => e.error).length / session.events.length,
      efficiency: calculateEfficiencyScore(session)
    }));
  }, [sessionData]);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart data={sessionMetrics}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis 
          type="number" 
          dataKey="toolCount" 
          name="Tool Operations"
          stroke="#9CA3AF"
        />
        <YAxis 
          type="number" 
          dataKey="p95ResponseTime" 
          name="P95 Response Time (ms)"
          stroke="#9CA3AF"
        />
        <ZAxis 
          type="number" 
          dataKey="duration" 
          range={[50, 400]} 
          name="Session Duration"
        />
        <Tooltip content={<SessionPerformanceTooltip />} />
        
        <Scatter 
          data={sessionMetrics}
          fill="#3B82F6"
          shape={(props) => (
            <circle
              {...props}
              r={Math.sqrt(props.payload.duration / 1000) + 3}
              fill={getEfficiencyColor(props.payload.efficiency)}
              opacity={0.7}
            />
          )}
        />
        
        {/* Performance threshold lines */}
        <ReferenceLine 
          y={1000} 
          stroke="#F59E0B" 
          strokeDasharray="3 3"
          label="P95 Warning Threshold"
        />
        <ReferenceLine 
          y={5000} 
          stroke="#EF4444" 
          strokeDasharray="3 3"
          label="P95 Critical Threshold"
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
};
```

## Percentile Analysis Techniques

### Percentile Calculation
Efficient percentile calculation for real-time dashboards.

```javascript
class PercentileCalculator {
  constructor(maxSamples = 10000) {
    this.samples = [];
    this.maxSamples = maxSamples;
    this.sorted = false;
  }
  
  addSample(value) {
    this.samples.push(value);
    this.sorted = false;
    
    // Maintain circular buffer for memory efficiency
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }
  
  getPercentile(percentile) {
    if (this.samples.length === 0) return 0;
    
    if (!this.sorted) {
      this.samples.sort((a, b) => a - b);
      this.sorted = true;
    }
    
    const index = Math.ceil((percentile / 100) * this.samples.length) - 1;
    return this.samples[Math.max(0, index)];
  }
  
  getPercentiles() {
    return {
      p50: this.getPercentile(50),
      p75: this.getPercentile(75),
      p90: this.getPercentile(90),
      p95: this.getPercentile(95),
      p99: this.getPercentile(99),
      p999: this.getPercentile(99.9)
    };
  }
}
```

### Rolling Window Percentiles
Calculate percentiles over rolling time windows.

```javascript
class RollingPercentiles {
  constructor(windowSize = 60000) { // 1 minute default
    this.windowSize = windowSize;
    this.dataPoints = [];
  }
  
  addDataPoint(timestamp, value) {
    this.dataPoints.push({ timestamp, value });
    this.cleanOldData(timestamp);
  }
  
  cleanOldData(currentTime) {
    const cutoff = currentTime - this.windowSize;
    this.dataPoints = this.dataPoints.filter(point => point.timestamp >= cutoff);
  }
  
  getCurrentPercentiles() {
    if (this.dataPoints.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }
    
    const values = this.dataPoints.map(p => p.value).sort((a, b) => a - b);
    
    return {
      p50: this.calculatePercentile(values, 50),
      p95: this.calculatePercentile(values, 95),
      p99: this.calculatePercentile(values, 99),
      count: values.length
    };
  }
  
  calculatePercentile(sortedValues, percentile) {
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }
}
```

## Real-time Performance Monitoring

### Performance Alerts
Implement real-time performance alerting.

```javascript
class PerformanceMonitor {
  constructor(thresholds) {
    this.thresholds = thresholds;
    this.percentileCalculator = new PercentileCalculator();
    this.alertCallbacks = [];
  }
  
  addPerformanceData(toolType, executionTime, timestamp) {
    this.percentileCalculator.addSample(executionTime);
    
    const percentiles = this.percentileCalculator.getPercentiles();
    const threshold = this.thresholds[toolType];
    
    // Check for performance degradation
    if (percentiles.p95 > threshold.critical) {
      this.triggerAlert('critical', {
        toolType,
        currentP95: percentiles.p95,
        threshold: threshold.critical,
        timestamp
      });
    } else if (percentiles.p95 > threshold.warning) {
      this.triggerAlert('warning', {
        toolType,
        currentP95: percentiles.p95,
        threshold: threshold.warning,
        timestamp
      });
    }
  }
  
  triggerAlert(level, data) {
    this.alertCallbacks.forEach(callback => callback(level, data));
  }
  
  onAlert(callback) {
    this.alertCallbacks.push(callback);
  }
}
```

### Performance Dashboard Hook
React hook for real-time performance monitoring.

```javascript
const usePerformanceMonitoring = (toolType, refreshInterval = 5000) => {
  const [performanceData, setPerformanceData] = useState({
    current: { p50: 0, p95: 0, p99: 0 },
    trend: [],
    alerts: []
  });
  
  const [monitor] = useState(() => 
    new PerformanceMonitor(TOOL_PERFORMANCE_BASELINES)
  );
  
  useEffect(() => {
    const handleAlert = (level, data) => {
      setPerformanceData(prev => ({
        ...prev,
        alerts: [...prev.alerts, { level, data, timestamp: Date.now() }]
      }));
    };
    
    monitor.onAlert(handleAlert);
    
    // Subscribe to real-time performance data
    const unsubscribe = subscribeToPerformanceEvents((event) => {
      if (!toolType || event.toolType === toolType) {
        monitor.addPerformanceData(
          event.toolType, 
          event.executionTime, 
          event.timestamp
        );
        
        const percentiles = monitor.percentileCalculator.getPercentiles();
        
        setPerformanceData(prev => ({
          ...prev,
          current: percentiles,
          trend: [
            ...prev.trend.slice(-99), // Keep last 100 points
            {
              timestamp: event.timestamp,
              p95: percentiles.p95
            }
          ]
        }));
      }
    });
    
    return unsubscribe;
  }, [toolType, monitor]);
  
  return performanceData;
};
```

## Custom Tooltip Components

### Performance Tooltip
Rich tooltip showing detailed performance metrics.

```jsx
const PerformanceTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0].payload;
  
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 shadow-lg min-w-64">
      <div className="text-gray-300 text-sm font-medium mb-2">
        {new Date(label).toLocaleString()}
      </div>
      
      <div className="space-y-2">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-300 text-sm">{entry.name}</span>
            </div>
            <span className="text-white font-medium">{entry.value}ms</span>
          </div>
        ))}
      </div>
      
      {data.sessionId && (
        <div className="mt-3 pt-2 border-t border-gray-600">
          <div className="text-xs text-gray-400">
            Session: {data.sessionId.slice(0, 8)}...
          </div>
          <div className="text-xs text-gray-400">
            Tool: {data.toolType}
          </div>
        </div>
      )}
      
      {/* Performance status indicator */}
      <div className="mt-2 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          getPerformanceStatusClass(entry.value)
        }`} />
        <span className="text-xs text-gray-400">
          {getPerformanceStatus(entry.value)}
        </span>
      </div>
    </div>
  );
};
```

## Best Practices

### Performance Monitoring Guidelines
1. **Percentile Selection**: Focus on P95 and P99 for user experience monitoring
2. **Time Windows**: Use appropriate rolling windows (1min, 5min, 1hour) based on use case
3. **Baseline Establishment**: Set realistic baselines based on tool complexity
4. **Alert Thresholds**: Implement graduated alerting (warning → critical)
5. **Data Retention**: Balance detail with storage efficiency

### Visualization Best Practices
1. **Color Coding**: Use consistent semantic colors across all performance visualizations
2. **Interactive Elements**: Enable drill-down for detailed analysis
3. **Real-time Updates**: Implement efficient real-time data streaming
4. **Performance Indicators**: Show clear visual indicators for performance status
5. **Comparative Analysis**: Enable period-over-period and tool-to-tool comparisons

### Data Processing Optimization
1. **Efficient Percentile Calculation**: Use optimized algorithms for large datasets
2. **Data Sampling**: Implement intelligent sampling for visualization performance
3. **Memory Management**: Use circular buffers for real-time metrics
4. **Caching**: Cache computed percentiles to reduce recalculation
5. **Batch Processing**: Process updates in batches to improve performance

This documentation provides comprehensive patterns for implementing performance metrics visualization in observability dashboards, with specific focus on response time analysis and percentile-based monitoring for the Chronicle MVP.