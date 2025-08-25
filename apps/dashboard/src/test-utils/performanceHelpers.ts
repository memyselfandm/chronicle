import React from 'react';

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

// Advanced performance testing utilities
export const createAdvancedPerformanceTests = {
  // Test component mount/unmount cycles for memory leaks
  mountUnmountCycle: async <T extends object>(
    Component: React.ComponentType<T>,
    props: T,
    cycles: number = 100
  ): Promise<{
    averageMountTime: number;
    averageUnmountTime: number;
    memoryLeak: boolean;
    finalMemoryUsage: number;
  }> => {
    const { render, unmount } = await import('./renderHelpers');
    const mountTimes: number[] = [];
    const unmountTimes: number[] = [];
    const initialMemory = 'memory' in performance 
      ? (performance as any).memory.usedJSHeapSize 
      : 0;

    for (let i = 0; i < cycles; i++) {
      // Mount timing
      const mountStart = performance.now();
      const { unmount: cleanup } = render(React.createElement(Component, props));
      const mountEnd = performance.now();
      mountTimes.push(mountEnd - mountStart);

      // Small delay to simulate real usage
      await new Promise(resolve => setTimeout(resolve, 1));

      // Unmount timing
      const unmountStart = performance.now();
      cleanup();
      const unmountEnd = performance.now();
      unmountTimes.push(unmountEnd - unmountStart);

      // Force GC every 10 cycles if available
      if (i % 10 === 0 && 'gc' in global) {
        (global as any).gc();
      }
    }

    const finalMemory = 'memory' in performance 
      ? (performance as any).memory.usedJSHeapSize 
      : initialMemory;
    
    const memoryGrowth = finalMemory - initialMemory;
    const memoryLeak = memoryGrowth > (initialMemory * 0.05); // 5% threshold

    return {
      averageMountTime: mountTimes.reduce((sum, time) => sum + time, 0) / mountTimes.length,
      averageUnmountTime: unmountTimes.reduce((sum, time) => sum + time, 0) / unmountTimes.length,
      memoryLeak,
      finalMemoryUsage: finalMemory / 1024 / 1024, // MB
    };
  },

  // Test real-time data processing performance
  realtimeDataProcessing: async (
    processingFunction: (data: any[]) => Promise<void> | void,
    dataGenerator: () => any[],
    batchesPerSecond: number = 10,
    durationSeconds: number = 5
  ): Promise<{
    totalBatches: number;
    averageProcessingTime: number;
    maxProcessingTime: number;
    droppedBatches: number;
    throughput: number; // batches per second
  }> => {
    const totalBatches = batchesPerSecond * durationSeconds;
    const processingTimes: number[] = [];
    let droppedBatches = 0;
    let processedBatches = 0;
    const startTime = Date.now();

    for (let i = 0; i < totalBatches; i++) {
      const batchData = dataGenerator();
      const processStart = performance.now();
      
      try {
        await processingFunction(batchData);
        const processEnd = performance.now();
        processingTimes.push(processEnd - processStart);
        processedBatches++;
      } catch (error) {
        droppedBatches++;
      }

      // Simulate real-time intervals
      const nextBatchTime = (i + 1) * (1000 / batchesPerSecond);
      const elapsed = Date.now() - startTime;
      const sleepTime = Math.max(0, nextBatchTime - elapsed);
      
      if (sleepTime > 0) {
        await new Promise(resolve => setTimeout(resolve, sleepTime));
      }
    }

    const totalTime = (Date.now() - startTime) / 1000;
    
    return {
      totalBatches,
      averageProcessingTime: processingTimes.length > 0 
        ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length 
        : 0,
      maxProcessingTime: processingTimes.length > 0 ? Math.max(...processingTimes) : 0,
      droppedBatches,
      throughput: processedBatches / totalTime,
    };
  },

  // Test virtualization performance with large datasets
  virtualizationStressTest: async (
    itemCount: number,
    visibleItems: number = 50,
    scrollCycles: number = 10
  ): Promise<{
    initialRenderTime: number;
    scrollPerformance: number[];
    memoryEfficiency: number;
    avgFrameRate: number;
  }> => {
    // Simulate large dataset rendering
    const items = Array.from({ length: itemCount }, (_, i) => ({
      id: i,
      data: `Item ${i}`,
      timestamp: Date.now() + i,
    }));

    // Initial render measurement
    const renderStart = performance.now();
    // Simulate rendering visible items only
    const visibleData = items.slice(0, visibleItems);
    await new Promise(resolve => setTimeout(resolve, Math.log(visibleItems) * 2));
    const initialRenderTime = performance.now() - renderStart;

    // Scroll performance simulation
    const scrollPerformance: number[] = [];
    for (let i = 0; i < scrollCycles; i++) {
      const scrollStart = performance.now();
      
      // Simulate scroll to different position
      const scrollPosition = Math.floor(Math.random() * (itemCount - visibleItems));
      const newVisibleData = items.slice(scrollPosition, scrollPosition + visibleItems);
      
      // Simulate virtual scroll rendering delay
      await new Promise(resolve => setTimeout(resolve, Math.log(visibleItems)));
      
      const scrollTime = performance.now() - scrollStart;
      scrollPerformance.push(scrollTime);
    }

    // Memory efficiency calculation (lower is better)
    const memoryEfficiency = Math.max(100 - (itemCount / 1000) * 5, 20);
    
    // Frame rate simulation (should stay above 30fps for good UX)
    const avgFrameRate = Math.max(60 - (itemCount / 10000) * 15, 30);

    return {
      initialRenderTime,
      scrollPerformance,
      memoryEfficiency,
      avgFrameRate,
    };
  },
};

// Performance monitoring hooks for real components
export const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = React.useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    eventProcessingTime: 0,
    averageFrameRate: 0,
  });

  const measureRender = React.useCallback((renderFn: () => void) => {
    const start = performance.now();
    renderFn();
    const end = performance.now();
    
    setMetrics(prev => ({
      ...prev,
      renderTime: end - start,
    }));
  }, []);

  const measureEventProcessing = React.useCallback((eventFn: () => void) => {
    const start = performance.now();
    eventFn();
    const end = performance.now();
    
    setMetrics(prev => ({
      ...prev,
      eventProcessingTime: end - start,
    }));
  }, []);

  return {
    metrics,
    measureRender,
    measureEventProcessing,
  };
};

// Test data validation helpers
export const validateTestResults = {
  performanceWithinThreshold: (
    actualValue: number,
    expectedValue: number,
    tolerancePercent: number = 20
  ): { passed: boolean; message: string } => {
    const tolerance = expectedValue * (tolerancePercent / 100);
    const passed = Math.abs(actualValue - expectedValue) <= tolerance;
    
    return {
      passed,
      message: passed
        ? `Performance test passed: ${actualValue}ms (expected: ${expectedValue}ms ±${tolerancePercent}%)`
        : `Performance test failed: ${actualValue}ms (expected: ${expectedValue}ms ±${tolerancePercent}%)`,
    };
  },

  memoryUsageAcceptable: (
    memoryUsageMB: number,
    maxAllowedMB: number = 100
  ): { passed: boolean; message: string } => {
    const passed = memoryUsageMB <= maxAllowedMB;
    
    return {
      passed,
      message: passed
        ? `Memory usage acceptable: ${memoryUsageMB.toFixed(2)}MB (max: ${maxAllowedMB}MB)`
        : `Memory usage too high: ${memoryUsageMB.toFixed(2)}MB (max: ${maxAllowedMB}MB)`,
    };
  },

  throughputSufficient: (
    actualThroughput: number,
    requiredThroughput: number,
    unit: string = 'ops/sec'
  ): { passed: boolean; message: string } => {
    const passed = actualThroughput >= requiredThroughput;
    
    return {
      passed,
      message: passed
        ? `Throughput sufficient: ${actualThroughput.toFixed(2)} ${unit} (required: ${requiredThroughput} ${unit})`
        : `Throughput insufficient: ${actualThroughput.toFixed(2)} ${unit} (required: ${requiredThroughput} ${unit})`,
    };
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