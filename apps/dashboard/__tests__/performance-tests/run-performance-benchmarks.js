#!/usr/bin/env node

/**
 * Performance Benchmarking Runner Script
 * Agent-5 Performance Testing Infrastructure
 * 
 * Runs comprehensive performance tests and generates detailed reports
 * for Chronicle Dashboard performance monitoring and regression detection.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PERFORMANCE_CONFIG = {
  testTimeout: 120000, // 2 minutes per test
  maxConcurrency: 1,   // Run performance tests sequentially
  verbose: true,
  collectCoverage: false, // Skip coverage for performance tests
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

const PERFORMANCE_TESTS = [
  {
    name: 'Comprehensive Performance',
    file: '__tests__/performance-tests/comprehensive-performance.test.tsx',
    description: 'Full system performance validation with large datasets',
    critical: true
  },
  {
    name: 'High-Frequency Events',
    file: '__tests__/performance-tests/high-frequency-events.test.tsx', 
    description: 'Burst event handling and real-time processing',
    critical: true
  },
  {
    name: 'Memory Optimization',
    file: '__tests__/performance-tests/memory-optimization.test.tsx',
    description: 'Memory leak detection and usage optimization',
    critical: true
  },
  {
    name: 'Load Testing',
    file: '__tests__/performance-tests/load-testing.test.tsx',
    description: 'Concurrent sessions and sustained load scenarios',
    critical: false
  }
];

const BENCHMARK_TARGETS = {
  'Dashboard Render': { target: 100, unit: 'ms', tolerance: 20 },
  'Event Processing': { target: 100, unit: 'ms', tolerance: 10 },
  'High Frequency Events': { target: 200, unit: 'events/sec', tolerance: 10 },
  'Memory Usage': { target: 50, unit: 'MB', tolerance: 25 },
  'Session Load': { target: 300, unit: 'ms', tolerance: 15 },
  'Virtual Scrolling': { target: 60, unit: 'fps', tolerance: 15 },
  'UI Responsiveness': { target: 100, unit: 'ms', tolerance: 20 }
};

class PerformanceBenchmarkRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      environment: this.getEnvironmentInfo(),
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        critical_failures: 0
      },
      benchmarks: {},
      recommendations: []
    };
  }

  getEnvironmentInfo() {
    return {
      node_version: process.version,
      platform: process.platform,
      architecture: process.arch,
      memory: process.memoryUsage(),
      cpu_count: require('os').cpus().length
    };
  }

  async runTest(test) {
    console.log(`\n🧪 Running ${test.name}...`);
    console.log(`   ${test.description}`);
    
    const startTime = Date.now();
    let success = false;
    let output = '';
    let error = null;

    try {
      // Run the specific test file with Jest
      const jestCommand = [
        'npx jest',
        `"${test.file}"`,
        '--verbose',
        '--no-coverage',
        '--maxWorkers=1',
        `--testTimeout=${PERFORMANCE_CONFIG.testTimeout}`,
        '--detectOpenHandles',
        '--forceExit'
      ].join(' ');

      console.log(`   Command: ${jestCommand}`);
      
      output = execSync(jestCommand, { 
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: PERFORMANCE_CONFIG.testTimeout * 2 // Give extra time for Jest startup
      });
      
      success = true;
      console.log(`   ✅ ${test.name} completed successfully`);
      
    } catch (err) {
      success = false;
      error = err.message;
      output = err.stdout || err.stderr || 'No output captured';
      
      console.log(`   ❌ ${test.name} failed: ${error.split('\n')[0]}`);
      
      if (test.critical) {
        this.results.summary.critical_failures++;
      }
    }

    const duration = Date.now() - startTime;
    
    const testResult = {
      name: test.name,
      file: test.file,
      description: test.description,
      success,
      duration,
      error,
      output: this.extractMetricsFromOutput(output),
      critical: test.critical
    };

    this.results.tests.push(testResult);
    this.results.summary.total++;
    
    if (success) {
      this.results.summary.passed++;
    } else {
      this.results.summary.failed++;
    }

    return testResult;
  }

  extractMetricsFromOutput(output) {
    const metrics = {};
    const lines = output.split('\n');
    
    // Extract performance metrics from console.log statements in tests
    lines.forEach(line => {
      // Look for patterns like "Dashboard Render Performance: 45.67ms avg"
      const renderMatch = line.match(/([^:]+):\s*(\d+\.?\d*)\s*(ms|MB|events\/sec|fps)\s*(avg|max)?/);
      if (renderMatch) {
        const [, name, value, unit] = renderMatch;
        metrics[name.trim()] = {
          value: parseFloat(value),
          unit: unit,
          raw: line.trim()
        };
      }
      
      // Extract test result summaries
      const summaryMatch = line.match(/([^:]+):\s*{\s*([^}]+)\s*}/);
      if (summaryMatch) {
        const [, testName, data] = summaryMatch;
        try {
          // Parse key-value pairs from the data
          const pairs = data.split(',').map(pair => pair.split(':').map(s => s.trim()));
          const parsed = {};
          pairs.forEach(([key, value]) => {
            if (key && value) {
              // Remove quotes and parse numbers
              const cleanKey = key.replace(/['"]/g, '');
              const cleanValue = value.replace(/['"]/g, '');
              const numValue = parseFloat(cleanValue);
              parsed[cleanKey] = isNaN(numValue) ? cleanValue : numValue;
            }
          });
          metrics[testName.trim()] = parsed;
        } catch (err) {
          // If parsing fails, just store the raw data
          metrics[testName.trim()] = { raw: data };
        }
      }
    });

    return metrics;
  }

  analyzeBenchmarks() {
    console.log('\n📊 Analyzing Performance Benchmarks...');
    
    this.results.tests.forEach(test => {
      Object.entries(test.output).forEach(([metricName, metricData]) => {
        if (typeof metricData === 'object' && metricData.value !== undefined) {
          const benchmark = BENCHMARK_TARGETS[metricName];
          
          if (benchmark) {
            const tolerance = benchmark.target * (benchmark.tolerance / 100);
            const passed = metricData.value <= (benchmark.target + tolerance);
            
            this.results.benchmarks[metricName] = {
              target: benchmark.target,
              actual: metricData.value,
              unit: benchmark.unit,
              tolerance: benchmark.tolerance,
              passed,
              deviation: ((metricData.value - benchmark.target) / benchmark.target) * 100,
              test: test.name
            };

            const status = passed ? '✅' : '❌';
            const deviation = this.results.benchmarks[metricName].deviation;
            console.log(`   ${status} ${metricName}: ${metricData.value}${metricData.unit} ` +
                       `(target: ${benchmark.target}${benchmark.unit}, ` +
                       `${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}%)`);
          }
        }
      });
    });
  }

  generateRecommendations() {
    console.log('\n🔍 Generating Performance Recommendations...');

    const recommendations = [];
    
    // Check for benchmark failures
    Object.entries(this.results.benchmarks).forEach(([metric, data]) => {
      if (!data.passed) {
        const severity = data.deviation > 50 ? 'HIGH' : data.deviation > 20 ? 'MEDIUM' : 'LOW';
        recommendations.push({
          type: 'BENCHMARK_FAILURE',
          severity,
          metric,
          message: `${metric} is ${data.deviation.toFixed(1)}% above target (${data.actual}${data.unit} vs ${data.target}${data.unit})`,
          suggestion: this.getBenchmarkSuggestion(metric, data)
        });
      }
    });

    // Check for critical test failures
    if (this.results.summary.critical_failures > 0) {
      recommendations.push({
        type: 'CRITICAL_FAILURE',
        severity: 'HIGH',
        message: `${this.results.summary.critical_failures} critical performance tests failed`,
        suggestion: 'Review failed tests immediately - these may indicate system performance regressions'
      });
    }

    // Check overall test success rate
    const successRate = (this.results.summary.passed / this.results.summary.total) * 100;
    if (successRate < 80) {
      recommendations.push({
        type: 'LOW_SUCCESS_RATE',
        severity: 'MEDIUM',
        message: `Performance test success rate is ${successRate.toFixed(1)}%`,
        suggestion: 'Investigate failing tests and consider system optimization'
      });
    }

    // Memory-related recommendations
    const memoryBenchmark = this.results.benchmarks['Memory Usage'];
    if (memoryBenchmark && memoryBenchmark.deviation > 30) {
      recommendations.push({
        type: 'MEMORY_OPTIMIZATION',
        severity: 'MEDIUM',
        message: 'Memory usage is significantly above target',
        suggestion: 'Consider implementing memory optimization strategies: object pooling, lazy loading, or data structure optimization'
      });
    }

    this.results.recommendations = recommendations;
    
    recommendations.forEach(rec => {
      const icon = rec.severity === 'HIGH' ? '🚨' : rec.severity === 'MEDIUM' ? '⚠️' : 'ℹ️';
      console.log(`   ${icon} ${rec.type}: ${rec.message}`);
      console.log(`      ${rec.suggestion}`);
    });
  }

  getBenchmarkSuggestion(metric, data) {
    const suggestions = {
      'Dashboard Render': 'Consider implementing component memoization, reducing initial data load, or optimizing CSS rendering',
      'Event Processing': 'Review event batching configuration, optimize processing logic, or consider worker threads',
      'High Frequency Events': 'Implement more efficient event batching, consider throttling, or optimize event handlers',
      'Memory Usage': 'Implement memory pooling, optimize data structures, or add garbage collection hints',
      'Session Load': 'Consider virtualization, lazy loading, or data pagination',
      'Virtual Scrolling': 'Optimize item rendering, reduce DOM manipulation, or implement more efficient scrolling',
      'UI Responsiveness': 'Implement request debouncing, optimize re-renders, or use web workers for heavy tasks'
    };

    return suggestions[metric] || 'Review implementation for performance optimization opportunities';
  }

  generateReport() {
    const reportPath = path.join(process.cwd(), 'performance-benchmark-results.json');
    const htmlReportPath = path.join(process.cwd(), 'performance-report.html');
    
    // Save JSON report
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 JSON Report saved to: ${reportPath}`);

    // Generate HTML report
    const htmlReport = this.generateHTMLReport();
    fs.writeFileSync(htmlReportPath, htmlReport);
    console.log(`📄 HTML Report saved to: ${htmlReportPath}`);

    return this.results;
  }

  generateHTMLReport() {
    const { summary, benchmarks, recommendations, tests, timestamp } = this.results;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chronicle Dashboard - Performance Benchmark Report</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 40px; }
        .header h1 { color: #333; margin-bottom: 10px; }
        .header .timestamp { color: #666; font-size: 14px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .summary-card h3 { margin-top: 0; color: #495057; }
        .summary-card .number { font-size: 2em; font-weight: bold; margin: 10px 0; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .benchmarks { margin-bottom: 40px; }
        .benchmark { display: flex; justify-content: space-between; align-items: center; padding: 15px; margin-bottom: 10px; border-radius: 6px; }
        .benchmark.pass { background: #d4edda; border-left: 4px solid #28a745; }
        .benchmark.fail { background: #f8d7da; border-left: 4px solid #dc3545; }
        .benchmark-name { font-weight: bold; }
        .benchmark-result { font-family: monospace; }
        .recommendations { margin-bottom: 40px; }
        .recommendation { padding: 15px; margin-bottom: 10px; border-radius: 6px; border-left: 4px solid; }
        .recommendation.high { background: #f8d7da; border-color: #dc3545; }
        .recommendation.medium { background: #fff3cd; border-color: #ffc107; }
        .recommendation.low { background: #d1ecf1; border-color: #17a2b8; }
        .tests { margin-bottom: 40px; }
        .test { margin-bottom: 20px; padding: 20px; border: 1px solid #dee2e6; border-radius: 6px; }
        .test.success { border-left: 4px solid #28a745; }
        .test.failed { border-left: 4px solid #dc3545; }
        .test-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .test-name { font-weight: bold; font-size: 1.1em; }
        .test-duration { color: #6c757d; font-size: 0.9em; }
        .test-description { color: #6c757d; margin-bottom: 10px; }
        .test-metrics { background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Chronicle Dashboard Performance Report</h1>
            <div class="timestamp">Generated: ${new Date(timestamp).toLocaleString()}</div>
        </div>

        <div class="summary">
            <div class="summary-card">
                <h3>Total Tests</h3>
                <div class="number">${summary.total}</div>
            </div>
            <div class="summary-card">
                <h3>Passed</h3>
                <div class="number passed">${summary.passed}</div>
            </div>
            <div class="summary-card">
                <h3>Failed</h3>
                <div class="number failed">${summary.failed}</div>
            </div>
            <div class="summary-card">
                <h3>Critical Failures</h3>
                <div class="number ${summary.critical_failures > 0 ? 'failed' : 'passed'}">${summary.critical_failures}</div>
            </div>
        </div>

        <h2>🎯 Performance Benchmarks</h2>
        <div class="benchmarks">
            ${Object.entries(benchmarks).map(([name, data]) => `
                <div class="benchmark ${data.passed ? 'pass' : 'fail'}">
                    <div class="benchmark-name">${name}</div>
                    <div class="benchmark-result">
                        ${data.actual}${data.unit} / ${data.target}${data.unit} 
                        (${data.deviation > 0 ? '+' : ''}${data.deviation.toFixed(1)}%)
                    </div>
                </div>
            `).join('')}
        </div>

        <h2>💡 Recommendations</h2>
        <div class="recommendations">
            ${recommendations.length === 0 ? '<p>🎉 All performance benchmarks are within acceptable ranges!</p>' : 
              recommendations.map(rec => `
                <div class="recommendation ${rec.severity.toLowerCase()}">
                    <strong>${rec.type.replace(/_/g, ' ')}</strong>: ${rec.message}<br>
                    <em>Suggestion: ${rec.suggestion}</em>
                </div>
              `).join('')}
        </div>

        <h2>🧪 Test Results</h2>
        <div class="tests">
            ${tests.map(test => `
                <div class="test ${test.success ? 'success' : 'failed'}">
                    <div class="test-header">
                        <span class="test-name">${test.success ? '✅' : '❌'} ${test.name}</span>
                        <span class="test-duration">${(test.duration / 1000).toFixed(1)}s</span>
                    </div>
                    <div class="test-description">${test.description}</div>
                    ${Object.keys(test.output).length > 0 ? `
                        <div class="test-metrics">
                            ${Object.entries(test.output).map(([key, value]) => 
                              `<div><strong>${key}:</strong> ${JSON.stringify(value, null, 2)}</div>`
                            ).join('')}
                        </div>
                    ` : ''}
                    ${test.error ? `<div style="color: #dc3545; margin-top: 10px;"><strong>Error:</strong> ${test.error}</div>` : ''}
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
  }

  async run() {
    console.log('🚀 Starting Chronicle Dashboard Performance Benchmarks');
    console.log(`📋 Running ${PERFORMANCE_TESTS.length} performance test suites...`);

    const startTime = Date.now();

    // Run each test suite
    for (const test of PERFORMANCE_TESTS) {
      await this.runTest(test);
    }

    const totalDuration = Date.now() - startTime;

    // Analyze results
    this.analyzeBenchmarks();
    this.generateRecommendations();

    // Generate reports
    const report = this.generateReport();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERFORMANCE BENCHMARK SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`Tests: ${report.summary.passed}/${report.summary.total} passed`);
    console.log(`Critical Failures: ${report.summary.critical_failures}`);
    console.log(`Benchmarks: ${Object.values(report.benchmarks).filter(b => b.passed).length}/${Object.keys(report.benchmarks).length} passed`);
    console.log(`Recommendations: ${report.recommendations.length}`);

    if (report.summary.critical_failures > 0) {
      console.log('\n🚨 CRITICAL PERFORMANCE ISSUES DETECTED');
      process.exit(1);
    } else if (report.summary.failed > 0) {
      console.log('\n⚠️ Some performance tests failed');
      process.exit(1);
    } else {
      console.log('\n✅ All performance benchmarks passed!');
      process.exit(0);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new PerformanceBenchmarkRunner();
  runner.run().catch(error => {
    console.error('💥 Benchmark runner failed:', error);
    process.exit(1);
  });
}

module.exports = PerformanceBenchmarkRunner;