# Recharts Interactive Charts Implementation Guide

## Overview
Recharts is a composable charting library built on React components and D3, designed specifically for React applications with native SVG support and minimal dependencies. This guide covers implementation patterns for interactive charts targeting observability dashboards with complex analytics requirements.

## Installation & Setup

```bash
npm install recharts react-is
# For TypeScript projects
npm install @types/recharts
```

## Core Chart Components

### Line Charts for Time Series Data
Perfect for response time trends and performance monitoring over time.

```jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ResponseTimeChart = ({ data, onPointClick }) => {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis 
          dataKey="timestamp" 
          tickFormatter={(value) => new Date(value).toLocaleTimeString()}
          stroke="#9CA3AF"
        />
        <YAxis 
          label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft' }}
          stroke="#9CA3AF"
        />
        <Tooltip 
          content={<CustomTooltip />}
          labelStyle={{ color: '#F3F4F6' }}
          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
        />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="p50" 
          stroke="#10B981" 
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6, fill: '#10B981' }}
          onClick={onPointClick}
        />
        <Line 
          type="monotone" 
          dataKey="p95" 
          stroke="#F59E0B" 
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6, fill: '#F59E0B' }}
        />
        <Line 
          type="monotone" 
          dataKey="p99" 
          stroke="#EF4444" 
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6, fill: '#EF4444' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
```

### Area Charts for Cumulative Metrics
Ideal for showing stacked metrics like tool usage over time.

```jsx
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts';

const ToolUsageAreaChart = ({ data, onBrushChange }) => {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorRead" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
          </linearGradient>
          <linearGradient id="colorEdit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
          </linearGradient>
          <linearGradient id="colorBash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.1}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="time" stroke="#9CA3AF" />
        <YAxis stroke="#9CA3AF" />
        <Tooltip 
          content={<CustomAreaTooltip />}
          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
        />
        <Area 
          type="monotone" 
          dataKey="readOps" 
          stackId="1" 
          stroke="#3B82F6" 
          fill="url(#colorRead)" 
        />
        <Area 
          type="monotone" 
          dataKey="editOps" 
          stackId="1" 
          stroke="#10B981" 
          fill="url(#colorEdit)" 
        />
        <Area 
          type="monotone" 
          dataKey="bashOps" 
          stackId="1" 
          stroke="#F59E0B" 
          fill="url(#colorBash)" 
        />
        <Brush 
          dataKey="time" 
          height={30} 
          stroke="#6B7280"
          onChange={onBrushChange}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
```

### Pie Charts for Distribution Analysis
Perfect for showing tool usage distribution and session breakdowns.

```jsx
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = {
  'Read': '#3B82F6',
  'Edit': '#10B981',
  'Bash': '#F59E0B',
  'Grep': '#8B5CF6',
  'Write': '#EF4444',
  'Other': '#6B7280'
};

const ToolDistributionPie = ({ data, onSegmentClick }) => {
  const [activeIndex, setActiveIndex] = useState(-1);

  const onPieEnter = (_, index) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(-1);
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={120}
          innerRadius={60}
          paddingAngle={2}
          dataKey="count"
          onMouseEnter={onPieEnter}
          onMouseLeave={onPieLeave}
          onClick={onSegmentClick}
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={COLORS[entry.tool]} 
              stroke={activeIndex === index ? '#F3F4F6' : 'none'}
              strokeWidth={activeIndex === index ? 2 : 0}
            />
          ))}
        </Pie>
        <Tooltip 
          content={<CustomPieTooltip />}
          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
        />
        <Legend 
          wrapperStyle={{ color: '#F3F4F6' }}
          onClick={(entry) => onSegmentClick(entry)}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};
```

### Scatter Plots for Correlation Analysis
Ideal for showing relationships between metrics like execution time vs. payload size.

```jsx
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts';

const PerformanceScatterChart = ({ data, onDotClick }) => {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis 
          type="number" 
          dataKey="payloadSize" 
          name="Payload Size (KB)"
          domain={['dataMin', 'dataMax']}
          stroke="#9CA3AF"
        />
        <YAxis 
          type="number" 
          dataKey="executionTime" 
          name="Execution Time (ms)"
          domain={['dataMin', 'dataMax']}
          stroke="#9CA3AF"
        />
        <ZAxis 
          type="number" 
          dataKey="errorCount" 
          range={[50, 400]} 
          name="Error Count"
        />
        <Tooltip 
          cursor={{ strokeDasharray: '3 3' }}
          content={<CustomScatterTooltip />}
          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
        />
        <Scatter 
          data={data} 
          fill="#3B82F6"
          onClick={onDotClick}
          shape={<CustomDot />}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
};
```

## Interactive Features Implementation

### Custom Tooltips
Create informative tooltips with rich context for observability data.

```jsx
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
        <p className="text-gray-300 text-sm font-medium">
          {new Date(label).toLocaleString()}
        </p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 mt-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-300 text-sm">
              {entry.name}: {entry.value}ms
            </span>
            {entry.payload.sessionId && (
              <span className="text-gray-500 text-xs ml-2">
                Session: {entry.payload.sessionId.slice(0, 8)}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }
  return null;
};
```

### Click Event Handling
Implement drill-down functionality for detailed analysis.

```jsx
const handleChartClick = (data, index, event) => {
  // Navigate to detailed view
  router.push(`/session/${data.sessionId}/event/${data.eventId}`);
  
  // Update filters
  setFilters(prev => ({
    ...prev,
    sessionId: data.sessionId,
    timeRange: [data.timestamp - 3600000, data.timestamp + 3600000]
  }));
  
  // Track analytics
  analytics.track('chart_point_clicked', {
    chartType: 'response_time',
    sessionId: data.sessionId,
    timestamp: data.timestamp
  });
};
```

### Legend Interaction
Enable series toggling for better data exploration.

```jsx
const [hiddenSeries, setHiddenSeries] = useState(new Set());

const handleLegendClick = (entry) => {
  const newHiddenSeries = new Set(hiddenSeries);
  
  if (newHiddenSeries.has(entry.dataKey)) {
    newHiddenSeries.delete(entry.dataKey);
  } else {
    newHiddenSeries.add(entry.dataKey);
  }
  
  setHiddenSeries(newHiddenSeries);
};

// In chart component
<Line 
  dataKey="p95" 
  stroke="#F59E0B"
  hide={hiddenSeries.has('p95')}
/>
```

## Performance Optimization

### Data Preprocessing
Optimize large datasets before rendering.

```jsx
const preprocessChartData = (rawData, maxPoints = 1000) => {
  if (rawData.length <= maxPoints) return rawData;
  
  // Implement data sampling for performance
  const step = Math.ceil(rawData.length / maxPoints);
  return rawData.filter((_, index) => index % step === 0);
};

// Use with useMemo for expensive calculations
const chartData = useMemo(() => 
  preprocessChartData(rawEventData, 500), 
  [rawEventData]
);
```

### Virtual Scrolling for Large Datasets
Implement pagination and virtual scrolling for massive datasets.

```jsx
const ChartWithPagination = ({ data, pageSize = 1000 }) => {
  const [currentPage, setCurrentPage] = useState(0);
  
  const paginatedData = useMemo(() => {
    const start = currentPage * pageSize;
    const end = start + pageSize;
    return data.slice(start, end);
  }, [data, currentPage, pageSize]);
  
  return (
    <div>
      <LineChart data={paginatedData}>
        {/* Chart components */}
      </LineChart>
      
      <div className="flex justify-between items-center mt-4">
        <button 
          onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
          disabled={currentPage === 0}
        >
          Previous
        </button>
        <span className="text-sm text-gray-500">
          Page {currentPage + 1} of {Math.ceil(data.length / pageSize)}
        </span>
        <button 
          onClick={() => setCurrentPage(p => p + 1)}
          disabled={(currentPage + 1) * pageSize >= data.length}
        >
          Next
        </button>
      </div>
    </div>
  );
};
```

## Animation Configuration

### Smooth Transitions
Configure animations for better user experience.

```jsx
<Line 
  type="monotone" 
  dataKey="responseTime" 
  stroke="#3B82F6"
  animationDuration={800}
  animationEasing="ease-in-out"
  animationBegin={0}
/>

<Area 
  type="monotone" 
  dataKey="throughput"
  animationDuration={1200}
  animationEasing="ease-out"
/>
```

### Real-time Data Updates
Handle live data updates with smooth animations.

```jsx
const [animationKey, setAnimationKey] = useState(0);

useEffect(() => {
  // Trigger re-animation when data updates
  setAnimationKey(prev => prev + 1);
}, [data]);

<LineChart key={animationKey} data={data}>
  {/* Chart components */}
</LineChart>
```

## Responsive Design

### Container Patterns
Ensure charts work across different screen sizes.

```jsx
const ResponsiveChart = ({ data, aspect = 16/9 }) => {
  return (
    <div className="w-full">
      <ResponsiveContainer 
        width="100%" 
        aspect={aspect}
        minHeight={300}
      >
        <LineChart data={data}>
          {/* Chart components */}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
```

### Mobile Optimization
Adapt charts for mobile devices.

```jsx
const isMobile = useMediaQuery('(max-width: 768px)');

<LineChart 
  data={data}
  margin={{
    top: 20,
    right: isMobile ? 10 : 30,
    left: isMobile ? 10 : 20,
    bottom: 5,
  }}
>
  <XAxis 
    tick={{ fontSize: isMobile ? 10 : 12 }}
    interval={isMobile ? 'preserveStartEnd' : 0}
  />
</LineChart>
```

## Real-time Considerations

### Data Streaming
Handle live data updates efficiently.

```jsx
const useRealtimeChartData = (subscription) => {
  const [data, setData] = useState([]);
  const maxDataPoints = 1000;
  
  useEffect(() => {
    const unsubscribe = subscription.on('new_event', (newEvent) => {
      setData(prevData => {
        const newData = [...prevData, newEvent];
        
        // Keep only recent data points for performance
        if (newData.length > maxDataPoints) {
          return newData.slice(-maxDataPoints);
        }
        
        return newData;
      });
    });
    
    return unsubscribe;
  }, [subscription]);
  
  return data;
};
```

### Debounced Updates
Prevent excessive re-renders with debouncing.

```jsx
const DebouncedChart = ({ data }) => {
  const [debouncedData, setDebouncedData] = useState(data);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedData(data);
    }, 100); // 100ms debounce
    
    return () => clearTimeout(timer);
  }, [data]);
  
  return <LineChart data={debouncedData} />;
};
```

## Error Handling

### Chart Error Boundaries
Gracefully handle chart rendering errors.

```jsx
class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Chart rendering error:', error, errorInfo);
    // Send to error tracking service
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-64 bg-gray-800 rounded-lg">
          <div className="text-center text-gray-400">
            <p>Failed to render chart</p>
            <button 
              onClick={() => this.setState({ hasError: false })}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

## Best Practices

1. **Data Structure**: Use consistent data formats across all charts
2. **Color Schemes**: Implement semantic color coding for observability metrics
3. **Accessibility**: Include proper ARIA labels and keyboard navigation
4. **Performance**: Implement data sampling for large datasets
5. **User Experience**: Provide loading states and error handling
6. **Responsive Design**: Ensure charts work across all device sizes
7. **Real-time Updates**: Use efficient update patterns for live data
8. **Interaction Patterns**: Implement consistent click and hover behaviors

This guide provides comprehensive patterns for implementing interactive charts with Recharts in observability dashboards, focusing on performance, user experience, and real-time data handling requirements.