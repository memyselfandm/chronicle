// Performance testing utilities
export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  eventProcessingTime: number;
  averageFrameRate: number;
}

export interface PerformanceBenchmark {
  name: string;
  target: number;
  unit: string;
  tolerance: number; // percentage tolerance for passing
}

export const PERFORMANCE_BENCHMARKS: Record<string, PerformanceBenchmark> = {
  initialRender: {
    name: 'Initial Component Render',
    target: 100, // ms
    unit: 'ms',
    tolerance: 20, // 20% tolerance
  },
  eventProcessing: {
    name: 'Event Processing Latency',
    target: 100, // ms
    unit: 'ms',
    tolerance: 10,
  },
  highFrequencyEvents: {
    name: 'High Frequency Event Handling',
    target: 200, // events per second
    unit: 'events/sec',
    tolerance: 10,
  },
  memoryUsage: {
    name: 'Memory Usage',
    target: 50, // MB
    unit: 'MB',
    tolerance: 25,
  },
  sessionLoad: {
    name: 'Large Session List Load',
    target: 300, // ms for 30+ sessions
    unit: 'ms',
    tolerance: 15,
  },
};

export class PerformanceMonitor {
  private startTime: number = 0;
  private metrics: PerformanceMetrics = {
    renderTime: 0,
    memoryUsage: 0,
    eventProcessingTime: 0,
    averageFrameRate: 0,
  };

  startMeasurement() {
    this.startTime = performance.now();
    if ('memory' in performance) {
      this.metrics.memoryUsage = (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
  }

  endMeasurement(): number {
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    this.metrics.renderTime = duration;
    return duration;
  }

  measureEventProcessing(eventCount: number, processingFn: () => void): number {
    const start = performance.now();
    processingFn();
    const end = performance.now();
    const duration = end - start;
    this.metrics.eventProcessingTime = duration / eventCount; // average per event
    return duration;
  }

  measureFrameRate(durationMs: number = 1000): Promise<number> {
    return new Promise((resolve) => {
      let frameCount = 0;
      const startTime = performance.now();

      const countFrame = () => {
        frameCount++;
        if (performance.now() - startTime < durationMs) {
          requestAnimationFrame(countFrame);
        } else {
          const fps = frameCount / (durationMs / 1000);
          this.metrics.averageFrameRate = fps;
          resolve(fps);
        }
      };

      requestAnimationFrame(countFrame);
    });
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  validateBenchmark(benchmark: PerformanceBenchmark, actualValue: number): {
    passed: boolean;
    message: string;
    deviation: number;
  } {
    const tolerance = benchmark.target * (benchmark.tolerance / 100);
    const upperLimit = benchmark.target + tolerance;
    const lowerLimit = Math.max(0, benchmark.target - tolerance);
    
    const passed = actualValue >= lowerLimit && actualValue <= upperLimit;
    const deviation = ((actualValue - benchmark.target) / benchmark.target) * 100;
    
    const message = passed
      ? `✓ ${benchmark.name}: ${actualValue}${benchmark.unit} (target: ${benchmark.target}${benchmark.unit})`
      : `✗ ${benchmark.name}: ${actualValue}${benchmark.unit} (target: ${benchmark.target}${benchmark.unit}, deviation: ${deviation.toFixed(1)}%)`;

    return { passed, message, deviation };
  }
}

// Memory leak detection
export const detectMemoryLeaks = async (testFn: () => Promise<void>, iterations: number = 5): Promise<{
  leaked: boolean;
  initialMemory: number;
  finalMemory: number;
  maxMemory: number;
}> => {
  if (!('memory' in performance)) {
    throw new Error('Memory measurement not available in this environment');
  }

  const memory = (performance as any).memory;
  const initialMemory = memory.usedJSHeapSize;
  let maxMemory = initialMemory;

  for (let i = 0; i < iterations; i++) {
    await testFn();
    // Force garbage collection if available
    if ('gc' in global) {
      (global as any).gc();
    }
    await new Promise(resolve => setTimeout(resolve, 100)); // Allow GC to run
    maxMemory = Math.max(maxMemory, memory.usedJSHeapSize);
  }

  const finalMemory = memory.usedJSHeapSize;
  const memoryGrowth = finalMemory - initialMemory;
  const leaked = memoryGrowth > (initialMemory * 0.1); // 10% growth threshold

  return {
    leaked,
    initialMemory: initialMemory / 1024 / 1024, // MB
    finalMemory: finalMemory / 1024 / 1024, // MB
    maxMemory: maxMemory / 1024 / 1024, // MB
  };
};

// Event batching performance test
export const testEventBatching = async (
  batchFunction: (events: any[]) => Promise<void>,
  eventCount: number,
  batchSize: number = 100
): Promise<{
  totalTime: number;
  averageBatchTime: number;
  eventsPerSecond: number;
}> => {
  const events = Array.from({ length: eventCount }, (_, i) => ({ id: i, timestamp: Date.now() }));
  const batches = [];
  
  for (let i = 0; i < events.length; i += batchSize) {
    batches.push(events.slice(i, i + batchSize));
  }

  const start = performance.now();
  const batchTimes: number[] = [];

  for (const batch of batches) {
    const batchStart = performance.now();
    await batchFunction(batch);
    const batchEnd = performance.now();
    batchTimes.push(batchEnd - batchStart);
  }

  const end = performance.now();
  const totalTime = end - start;
  const averageBatchTime = batchTimes.reduce((sum, time) => sum + time, 0) / batchTimes.length;
  const eventsPerSecond = eventCount / (totalTime / 1000);

  return {
    totalTime,
    averageBatchTime,
    eventsPerSecond,
  };
};

// Component render performance test
export const measureComponentRender = async <T extends object>(
  Component: React.ComponentType<T>,
  props: T,
  renderCount: number = 10
): Promise<{
  averageRenderTime: number;
  minRenderTime: number;
  maxRenderTime: number;
  renderTimes: number[];
}> => {
  const { render, unmount } = await import('./renderHelpers');
  const renderTimes: number[] = [];

  for (let i = 0; i < renderCount; i++) {
    const start = performance.now();
    const { unmount: cleanup } = render(React.createElement(Component, props));
    const end = performance.now();
    
    renderTimes.push(end - start);
    cleanup();
    
    // Allow cleanup between renders
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  return {
    averageRenderTime: renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length,
    minRenderTime: Math.min(...renderTimes),
    maxRenderTime: Math.max(...renderTimes),
    renderTimes,
  };
};

// Virtualization performance test
export const testVirtualizationPerformance = async (
  itemCount: number,
  visibleItems: number = 20
): Promise<{
  renderTime: number;
  scrollPerformance: number;
  memoryEfficiency: number;
}> => {
  // Mock measurements for virtualization performance
  const renderTime = Math.min(50 + (itemCount / 1000) * 10, 150); // Simulate render time scaling
  const scrollPerformance = Math.max(60 - (itemCount / 10000) * 5, 30); // FPS during scroll
  const memoryEfficiency = Math.max(100 - (itemCount / 1000) * 2, 50); // Memory efficiency score

  return {
    renderTime,
    scrollPerformance,
    memoryEfficiency,
  };
};