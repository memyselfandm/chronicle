# Performance Testing Scripts

This directory contains performance testing and monitoring scripts for the Chronicle system.

## Scripts

### `benchmark_performance.py`
Comprehensive performance benchmark script that tests:
- Data processing operations
- Hook execution performance  
- Concurrent execution capabilities
- Memory usage patterns
- Realistic development workflows
- Error handling scenarios

**Usage:**
```bash
python scripts/performance/benchmark_performance.py
```

### `performance_monitor.py`
Advanced performance monitoring and testing suite that provides:
- Real-time performance metrics collection
- Single event processing benchmarks
- Concurrent processing tests
- Large payload handling
- Burst processing capabilities
- Memory stability testing
- Error resilience validation

**Usage:**
```bash
python scripts/performance/performance_monitor.py
```

### `realtime_stress_test.py`
Real-time stress testing for event flow from hooks to dashboard:
- Sustained throughput testing
- Concurrent session simulation
- Burst scenario testing
- Memory usage under load
- Error propagation testing
- WebSocket stress testing

**Usage:**
```bash
python scripts/performance/realtime_stress_test.py
```

## Output

All scripts generate detailed performance reports and can save results to JSON files for further analysis. Results include:
- Throughput measurements (events per second)
- Latency statistics (avg, p95, p99)
- Memory usage patterns
- Error rates and recovery times
- Performance bottleneck identification

## Requirements

These scripts may require additional dependencies beyond the base Chronicle requirements:
- `psutil` for memory monitoring
- `websockets` for WebSocket testing (realtime_stress_test.py)
- `requests` for HTTP testing

Install with: `pip install psutil websockets requests`