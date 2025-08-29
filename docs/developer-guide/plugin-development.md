# Chronicle Plugin Development Guide

## Overview

Chronicle is designed with extensibility in mind, allowing developers to create custom hooks, dashboard components, and server extensions. This guide covers how to build plugins and extensions for Chronicle.

## Plugin Architecture

Chronicle supports several types of plugins:

1. **Custom Hooks** - Capture additional events from Claude Code
2. **Dashboard Components** - Add new visualizations and widgets
3. **Event Processors** - Custom event processing and transformation
4. **Backend Extensions** - Extend server functionality
5. **Export Plugins** - Custom data export formats

## Custom Hook Development

### Hook System Overview

Chronicle hooks integrate with Claude Code's event system to capture agent activities. Hooks are Python scripts that execute at specific points in the Claude Code lifecycle.

### Creating a Custom Hook

#### 1. Basic Hook Structure

```python
# custom_hooks/my_custom_hook.py
#!/usr/bin/env python3
"""
Custom Chronicle Hook - Example Implementation
Captures custom events based on specific conditions.
"""

import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any, Optional

# Import Chronicle's base hook system
try:
    from ..lib.base_hook import BaseHook
    from ..lib.utils import get_session_info, sanitize_data
    from ..lib.database import get_database_connection
except ImportError:
    # Fallback for development/testing
    import os
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))
    from lib.base_hook import BaseHook
    from lib.utils import get_session_info, sanitize_data
    from lib.database import get_database_connection

logger = logging.getLogger(__name__)


class MyCustomHook(BaseHook):
    """
    Custom hook that captures specific events based on conditions.
    
    This hook demonstrates how to create custom event capture logic
    with proper error handling and data sanitization.
    """
    
    def __init__(self):
        super().__init__()
        self.name = "my_custom_hook"
        self.version = "1.0.0"
        
        # Custom configuration
        self.capture_patterns = [
            "specific_tool_usage",
            "error_conditions",
            "performance_metrics"
        ]
    
    def should_run(self, context: Dict[str, Any]) -> bool:
        """
        Determine if this hook should execute based on context.
        
        Args:
            context: Hook execution context from Claude Code
            
        Returns:
            bool: True if hook should execute
        """
        try:
            # Custom logic to determine execution
            tool_name = context.get("tool_name", "")
            event_type = context.get("event_type", "")
            
            # Example: Only run for specific tools
            if tool_name in ["bash", "python", "git"]:
                return True
                
            # Example: Only run for specific event types
            if event_type in self.capture_patterns:
                return True
                
            return False
            
        except Exception as e:
            logger.warning(f"Hook condition check failed: {e}")
            return False
    
    def execute(self, context: Dict[str, Any]) -> bool:
        """
        Execute the custom hook logic.
        
        Args:
            context: Hook execution context
            
        Returns:
            bool: True if executed successfully
        """
        try:
            # Extract relevant data from context
            session_info = get_session_info()
            tool_name = context.get("tool_name")
            command = context.get("command", "")
            
            # Custom event data
            custom_data = {
                "hook_name": self.name,
                "tool_name": tool_name,
                "command_length": len(command),
                "execution_context": self._analyze_context(context),
                "performance_metrics": self._collect_metrics(context)
            }
            
            # Create event with custom data
            event = self.create_event(
                session_id=session_info.get("session_id"),
                event_type="custom_tool_analysis",
                data=custom_data,
                tool_name=tool_name
            )
            
            # Store event
            return self.store_event(event)
            
        except Exception as e:
            logger.error(f"Custom hook execution failed: {e}")
            return False
    
    def _analyze_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Perform custom context analysis."""
        analysis = {
            "has_flags": bool(context.get("flags")),
            "command_complexity": self._calculate_complexity(context),
            "potential_risks": self._assess_risks(context)
        }
        
        return sanitize_data(analysis)
    
    def _calculate_complexity(self, context: Dict[str, Any]) -> int:
        """Calculate command complexity score."""
        command = context.get("command", "")
        complexity = 0
        
        # Simple complexity metrics
        complexity += len(command.split())  # Word count
        complexity += command.count("|")    # Pipe count
        complexity += command.count("&&")   # Chain count
        
        return min(complexity, 100)  # Cap at 100
    
    def _assess_risks(self, context: Dict[str, Any]) -> list:
        """Assess potential security/safety risks."""
        command = context.get("command", "").lower()
        risks = []
        
        risk_patterns = {
            "destructive": ["rm -rf", "del /f", "format", "mkfs"],
            "network": ["curl", "wget", "nc ", "telnet"],
            "system": ["sudo", "chmod 777", "chown"]
        }
        
        for category, patterns in risk_patterns.items():
            if any(pattern in command for pattern in patterns):
                risks.append(category)
        
        return risks
    
    def _collect_metrics(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Collect custom performance metrics."""
        return {
            "timestamp": self.get_timestamp(),
            "memory_usage": self._get_memory_usage(),
            "execution_time": context.get("duration_ms", 0)
        }
    
    def _get_memory_usage(self) -> int:
        """Get current memory usage in MB."""
        try:
            import psutil
            process = psutil.Process()
            return int(process.memory_info().rss / 1024 / 1024)
        except ImportError:
            return 0


# Hook execution entry point
def main():
    """Main entry point for Claude Code hook execution."""
    try:
        # Parse context from command line or environment
        context = parse_hook_context()
        
        # Create and execute hook
        hook = MyCustomHook()
        
        if hook.should_run(context):
            success = hook.execute(context)
            sys.exit(0 if success else 1)
        else:
            sys.exit(0)  # Skip execution but don't fail
            
    except Exception as e:
        logger.error(f"Custom hook failed: {e}")
        sys.exit(1)


def parse_hook_context() -> Dict[str, Any]:
    """Parse hook context from environment and arguments."""
    context = {}
    
    # Get context from environment variables
    context.update({
        "tool_name": os.environ.get("CLAUDE_TOOL_NAME"),
        "command": os.environ.get("CLAUDE_COMMAND"),
        "session_id": os.environ.get("CLAUDE_SESSION_ID"),
        "event_type": os.environ.get("CHRONICLE_EVENT_TYPE")
    })
    
    # Parse command line arguments if needed
    if len(sys.argv) > 1:
        try:
            context.update(json.loads(sys.argv[1]))
        except json.JSONDecodeError:
            pass
    
    return context


if __name__ == "__main__":
    main()
```

#### 2. Hook Configuration

Create a configuration file for your custom hook:

```json
// custom_hooks/my_custom_hook.json
{
  "name": "my_custom_hook",
  "version": "1.0.0",
  "description": "Custom hook for advanced tool analysis",
  "author": "Your Name",
  "trigger_events": [
    "pre_tool_use",
    "post_tool_use"
  ],
  "enabled": true,
  "settings": {
    "capture_patterns": [
      "bash",
      "python",
      "git"
    ],
    "risk_assessment": true,
    "performance_metrics": true
  },
  "dependencies": [
    "psutil>=5.0.0"
  ]
}
```

#### 3. Hook Installation

```python
# install_custom_hook.py
#!/usr/bin/env python3
"""Install custom Chronicle hook."""

import json
import shutil
import sys
from pathlib import Path

def install_custom_hook():
    """Install the custom hook into Chronicle."""
    
    # Chronicle hooks directory
    chronicle_dir = Path.home() / ".claude" / "hooks" / "chronicle"
    custom_hooks_dir = chronicle_dir / "src" / "hooks" / "custom"
    
    # Create custom hooks directory
    custom_hooks_dir.mkdir(parents=True, exist_ok=True)
    
    # Copy hook files
    source_dir = Path(__file__).parent
    
    # Copy Python file
    shutil.copy2(
        source_dir / "my_custom_hook.py",
        custom_hooks_dir / "my_custom_hook.py"
    )
    
    # Copy configuration
    shutil.copy2(
        source_dir / "my_custom_hook.json", 
        custom_hooks_dir / "my_custom_hook.json"
    )
    
    # Update Chronicle configuration
    settings_file = chronicle_dir / "config" / "custom_hooks.json"
    
    if settings_file.exists():
        with open(settings_file, 'r') as f:
            settings = json.load(f)
    else:
        settings = {"custom_hooks": []}
    
    # Add hook configuration
    hook_config = {
        "name": "my_custom_hook",
        "path": "src/hooks/custom/my_custom_hook.py",
        "config": "src/hooks/custom/my_custom_hook.json",
        "enabled": True
    }
    
    # Update or add hook
    existing_hook = None
    for i, hook in enumerate(settings["custom_hooks"]):
        if hook["name"] == "my_custom_hook":
            existing_hook = i
            break
    
    if existing_hook is not None:
        settings["custom_hooks"][existing_hook] = hook_config
    else:
        settings["custom_hooks"].append(hook_config)
    
    # Save updated settings
    settings_file.parent.mkdir(parents=True, exist_ok=True)
    with open(settings_file, 'w') as f:
        json.dump(settings, f, indent=2)
    
    print(f"Custom hook 'my_custom_hook' installed successfully!")
    print(f"Configuration: {custom_hooks_dir / 'my_custom_hook.json'}")

if __name__ == "__main__":
    install_custom_hook()
```

### Testing Custom Hooks

```python
# test_my_custom_hook.py
import pytest
import tempfile
from unittest.mock import Mock, patch
from my_custom_hook import MyCustomHook

class TestMyCustomHook:
    
    @pytest.fixture
    def hook(self):
        return MyCustomHook()
    
    @pytest.fixture
    def sample_context(self):
        return {
            "tool_name": "bash",
            "command": "ls -la | grep test",
            "session_id": "test-session",
            "event_type": "pre_tool_use"
        }
    
    def test_should_run_with_bash(self, hook, sample_context):
        """Test hook runs for bash commands."""
        assert hook.should_run(sample_context) is True
    
    def test_should_not_run_with_other_tools(self, hook):
        """Test hook skips for other tools."""
        context = {
            "tool_name": "unsupported_tool",
            "event_type": "other"
        }
        assert hook.should_run(context) is False
    
    def test_complexity_calculation(self, hook):
        """Test command complexity calculation."""
        context = {"command": "ls -la | grep test && echo done"}
        complexity = hook._calculate_complexity(context)
        assert complexity > 0
    
    def test_risk_assessment(self, hook):
        """Test security risk assessment.""" 
        context = {"command": "rm -rf /tmp/test"}
        risks = hook._assess_risks(context)
        assert "destructive" in risks
    
    @patch('my_custom_hook.get_session_info')
    @patch.object(MyCustomHook, 'store_event')
    def test_successful_execution(self, mock_store, mock_session, hook, sample_context):
        """Test successful hook execution."""
        mock_session.return_value = {"session_id": "test-session"}
        mock_store.return_value = True
        
        result = hook.execute(sample_context)
        
        assert result is True
        mock_store.assert_called_once()
```

## Dashboard Component Development

### Creating Custom Dashboard Components

#### 1. React Component Structure

```typescript
// src/components/custom/CustomMetricsWidget.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { Card } from '../ui/Card';
import { useEvents } from '../../hooks/useEvents';
import { ChronicleEvent } from '../../types/events';

interface CustomMetricsData {
  toolUsageCount: Record<string, number>;
  complexityAverage: number;
  riskLevels: Record<string, number>;
  lastUpdated: string;
}

interface CustomMetricsWidgetProps {
  sessionId?: string;
  timeRange?: string;
  className?: string;
}

export const CustomMetricsWidget: React.FC<CustomMetricsWidgetProps> = ({
  sessionId,
  timeRange = '24h',
  className = ''
}) => {
  const { events, isLoading, error } = useEvents({
    session_id: sessionId,
    event_type: 'custom_tool_analysis',
    limit: 1000
  });
  
  const [metricsData, setMetricsData] = useState<CustomMetricsData>({
    toolUsageCount: {},
    complexityAverage: 0,
    riskLevels: {},
    lastUpdated: new Date().toISOString()
  });
  
  // Process events into metrics
  const processedMetrics = useMemo(() => {
    if (!events || events.length === 0) {
      return metricsData;
    }
    
    const toolUsage: Record<string, number> = {};
    const complexityScores: number[] = [];
    const risks: Record<string, number> = {};
    
    events.forEach((event: ChronicleEvent) => {
      const metadata = event.metadata || {};
      
      // Count tool usage
      if (metadata.tool_name) {
        toolUsage[metadata.tool_name] = (toolUsage[metadata.tool_name] || 0) + 1;
      }
      
      // Collect complexity scores
      if (metadata.execution_context?.command_complexity) {
        complexityScores.push(metadata.execution_context.command_complexity);
      }
      
      // Count risk categories
      if (metadata.execution_context?.potential_risks) {
        metadata.execution_context.potential_risks.forEach((risk: string) => {
          risks[risk] = (risks[risk] || 0) + 1;
        });
      }
    });
    
    return {
      toolUsageCount: toolUsage,
      complexityAverage: complexityScores.length > 0 
        ? complexityScores.reduce((a, b) => a + b, 0) / complexityScores.length 
        : 0,
      riskLevels: risks,
      lastUpdated: new Date().toISOString()
    };
  }, [events]);
  
  useEffect(() => {
    setMetricsData(processedMetrics);
  }, [processedMetrics]);
  
  if (isLoading) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card className={`p-4 border-red-200 ${className}`}>
        <div className="text-red-600">
          <h3 className="font-semibold">Error Loading Metrics</h3>
          <p className="text-sm">{error}</p>
        </div>
      </Card>
    );
  }
  
  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Custom Tool Metrics</h3>
          <span className="text-xs text-gray-500">
            Updated: {new Date(metricsData.lastUpdated).toLocaleTimeString()}
          </span>
        </div>
        
        {/* Tool Usage Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Tool Usage</h4>
          <div className="space-y-1">
            {Object.entries(metricsData.toolUsageCount).map(([tool, count]) => (
              <div key={tool} className="flex items-center justify-between">
                <span className="text-sm">{tool}</span>
                <div className="flex items-center space-x-2">
                  <div 
                    className="h-2 bg-blue-500 rounded"
                    style={{ 
                      width: `${Math.max(20, (count / Math.max(...Object.values(metricsData.toolUsageCount))) * 100)}px` 
                    }}
                  />
                  <span className="text-xs text-gray-500">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Complexity Average */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Average Complexity</h4>
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, metricsData.complexityAverage)}%` }}
              />
            </div>
            <span className="text-sm font-medium">
              {metricsData.complexityAverage.toFixed(1)}
            </span>
          </div>
        </div>
        
        {/* Risk Assessment */}
        {Object.keys(metricsData.riskLevels).length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Risk Categories</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(metricsData.riskLevels).map(([risk, count]) => (
                <span 
                  key={risk}
                  className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs"
                >
                  {risk}: {count}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

// Export component metadata for plugin system
export const CustomMetricsWidgetMeta = {
  name: 'CustomMetricsWidget',
  displayName: 'Custom Tool Metrics',
  description: 'Advanced metrics for tool usage analysis',
  category: 'analytics',
  version: '1.0.0',
  author: 'Your Name',
  props: {
    sessionId: { type: 'string', optional: true },
    timeRange: { type: 'string', default: '24h' },
    className: { type: 'string', optional: true }
  }
};
```

#### 2. Plugin Registration

```typescript
// src/plugins/customMetricsPlugin.ts
import { CustomMetricsWidget, CustomMetricsWidgetMeta } from '../components/custom/CustomMetricsWidget';
import { DashboardPlugin } from '../types/plugins';

export const customMetricsPlugin: DashboardPlugin = {
  id: 'custom-metrics',
  name: 'Custom Metrics Plugin',
  version: '1.0.0',
  components: [
    {
      component: CustomMetricsWidget,
      metadata: CustomMetricsWidgetMeta
    }
  ],
  hooks: {
    // Optional: Add dashboard lifecycle hooks
    onLoad: () => {
      console.log('Custom Metrics Plugin loaded');
    },
    onUnload: () => {
      console.log('Custom Metrics Plugin unloaded');
    }
  },
  settings: {
    defaultTimeRange: '24h',
    enableRiskAnalysis: true
  }
};

// Register plugin with Chronicle dashboard
if (typeof window !== 'undefined' && window.Chronicle) {
  window.Chronicle.registerPlugin(customMetricsPlugin);
}
```

#### 3. Plugin Configuration

```json
// plugins/custom-metrics/plugin.json
{
  "id": "custom-metrics",
  "name": "Custom Metrics Plugin",
  "version": "1.0.0",
  "description": "Advanced tool usage metrics and analysis",
  "author": "Your Name",
  "type": "dashboard-component",
  "entry": "customMetricsPlugin.ts",
  "dependencies": {
    "react": ">=18.0.0",
    "chronicle-dashboard": ">=1.0.0"
  },
  "settings": {
    "enabled": true,
    "defaultPosition": {
      "grid": { "x": 0, "y": 0, "w": 6, "h": 4 }
    }
  },
  "permissions": [
    "read-events",
    "read-sessions"
  ]
}
```

## Event Processor Plugins

### Custom Event Processing

```python
# plugins/custom_processor.py
from typing import Dict, Any, List, Optional
from chronicle.lib.base_processor import BaseEventProcessor

class CustomEventProcessor(BaseEventProcessor):
    """
    Custom event processor for specialized data transformation.
    """
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__()
        self.config = config
        self.name = "custom_processor"
        
        # Initialize custom processing rules
        self.processing_rules = config.get("rules", [])
        self.enrichment_enabled = config.get("enrichment", True)
    
    def process_event(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Process a single event with custom logic.
        
        Args:
            event: Raw event data
            
        Returns:
            Processed event data or None to discard
        """
        try:
            # Apply custom processing rules
            processed_event = self._apply_rules(event)
            
            if not processed_event:
                return None
            
            # Add enrichment data
            if self.enrichment_enabled:
                processed_event = self._enrich_event(processed_event)
            
            # Custom validation
            if self._validate_processed_event(processed_event):
                return processed_event
            
            return None
            
        except Exception as e:
            self.logger.error(f"Event processing failed: {e}")
            return None
    
    def process_batch(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process multiple events efficiently."""
        processed_events = []
        
        for event in events:
            processed = self.process_event(event)
            if processed:
                processed_events.append(processed)
        
        # Apply batch-level processing
        return self._apply_batch_rules(processed_events)
    
    def _apply_rules(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Apply processing rules to event."""
        for rule in self.processing_rules:
            rule_type = rule.get("type")
            
            if rule_type == "filter":
                if not self._apply_filter_rule(event, rule):
                    return None
            
            elif rule_type == "transform":
                event = self._apply_transform_rule(event, rule)
            
            elif rule_type == "enrich":
                event = self._apply_enrich_rule(event, rule)
        
        return event
    
    def _apply_filter_rule(self, event: Dict[str, Any], rule: Dict[str, Any]) -> bool:
        """Apply filter rule to determine if event should be kept."""
        conditions = rule.get("conditions", [])
        
        for condition in conditions:
            field = condition.get("field")
            operator = condition.get("operator")
            value = condition.get("value")
            
            event_value = self._get_nested_field(event, field)
            
            if not self._evaluate_condition(event_value, operator, value):
                return False
        
        return True
    
    def _apply_transform_rule(self, event: Dict[str, Any], rule: Dict[str, Any]) -> Dict[str, Any]:
        """Apply transformation rule to modify event."""
        transformations = rule.get("transformations", [])
        
        for transform in transformations:
            transform_type = transform.get("type")
            
            if transform_type == "rename_field":
                event = self._rename_field(event, transform)
            elif transform_type == "add_field":
                event = self._add_field(event, transform)
            elif transform_type == "remove_field":
                event = self._remove_field(event, transform)
        
        return event
    
    def _enrich_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Add enrichment data to event."""
        enrichment = {
            "processing_timestamp": self.get_timestamp(),
            "processor_version": self.version,
            "custom_metrics": self._calculate_metrics(event)
        }
        
        event["enrichment"] = enrichment
        return event
```

## Backend Extensions

### Server Extension Example

```python
# extensions/metrics_extension.py
from fastapi import APIRouter, Depends, HTTPException
from chronicle.server.database import get_database
from typing import Dict, Any

# Create extension router
extension_router = APIRouter(prefix="/extensions/metrics", tags=["metrics"])

@extension_router.get("/advanced-analytics")
async def get_advanced_analytics(
    days: int = 30,
    db = Depends(get_database)
) -> Dict[str, Any]:
    """Get advanced analytics data."""
    
    try:
        # Custom analytics logic
        analytics = {
            "productivity_score": calculate_productivity_score(db, days),
            "tool_efficiency": analyze_tool_efficiency(db, days), 
            "error_patterns": identify_error_patterns(db, days),
            "recommendations": generate_recommendations(db, days)
        }
        
        return {
            "success": True,
            "data": analytics,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def calculate_productivity_score(db, days: int) -> float:
    """Calculate productivity score based on events."""
    # Custom productivity calculation
    pass

def analyze_tool_efficiency(db, days: int) -> Dict[str, Any]:
    """Analyze tool usage efficiency."""
    # Custom efficiency analysis
    pass

# Extension metadata
EXTENSION_META = {
    "name": "Advanced Metrics Extension",
    "version": "1.0.0", 
    "description": "Advanced analytics and metrics for Chronicle",
    "endpoints": [
        "/extensions/metrics/advanced-analytics"
    ]
}
```

## Plugin Testing

### Unit Testing for Plugins

```python
# test_custom_plugin.py
import pytest
from unittest.mock import Mock, patch
from your_plugin.custom_processor import CustomEventProcessor

class TestCustomEventProcessor:
    
    @pytest.fixture
    def processor_config(self):
        return {
            "rules": [
                {
                    "type": "filter",
                    "conditions": [
                        {"field": "event_type", "operator": "eq", "value": "tool_use"}
                    ]
                }
            ],
            "enrichment": True
        }
    
    @pytest.fixture
    def processor(self, processor_config):
        return CustomEventProcessor(processor_config)
    
    def test_process_valid_event(self, processor):
        """Test processing a valid event."""
        event = {
            "event_type": "tool_use",
            "tool_name": "bash",
            "metadata": {"command": "ls -la"}
        }
        
        result = processor.process_event(event)
        
        assert result is not None
        assert result["event_type"] == "tool_use"
        assert "enrichment" in result
    
    def test_filter_invalid_event(self, processor):
        """Test filtering out invalid events."""
        event = {
            "event_type": "invalid_type",
            "metadata": {}
        }
        
        result = processor.process_event(event)
        
        assert result is None
```

### Integration Testing

```python
# test_plugin_integration.py
import pytest
import requests
from chronicle.test_utils import create_test_server

class TestPluginIntegration:
    
    @pytest.fixture
    def server_with_plugin(self):
        # Create test server with plugin loaded
        server = create_test_server()
        server.load_plugin("custom_metrics_plugin")
        return server
    
    def test_plugin_endpoints_available(self, server_with_plugin):
        """Test plugin endpoints are accessible."""
        response = requests.get(
            f"{server_with_plugin.base_url}/extensions/metrics/advanced-analytics"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
```

## Plugin Distribution

### Package Structure

```
my-chronicle-plugin/
├── setup.py
├── README.md
├── requirements.txt
├── my_plugin/
│   ├── __init__.py
│   ├── hooks/
│   │   └── custom_hook.py
│   ├── components/
│   │   └── CustomWidget.tsx
│   ├── processors/
│   │   └── custom_processor.py
│   └── config/
│       └── plugin.json
├── tests/
│   ├── test_hooks.py
│   ├── test_components.tsx
│   └── test_processors.py
└── docs/
    ├── installation.md
    ├── configuration.md
    └── api.md
```

### Plugin Manifest

```json
{
  "name": "my-chronicle-plugin",
  "version": "1.0.0",
  "description": "Custom Chronicle plugin with hooks and dashboard components",
  "author": "Your Name",
  "license": "MIT",
  "chronicle_version": ">=1.0.0",
  "type": "full-plugin",
  "components": {
    "hooks": [
      {
        "name": "custom_hook",
        "path": "hooks/custom_hook.py",
        "triggers": ["pre_tool_use", "post_tool_use"]
      }
    ],
    "dashboard": [
      {
        "name": "CustomWidget", 
        "path": "components/CustomWidget.tsx",
        "category": "analytics"
      }
    ],
    "processors": [
      {
        "name": "custom_processor",
        "path": "processors/custom_processor.py"
      }
    ]
  },
  "dependencies": {
    "python": [
      "psutil>=5.0.0",
      "numpy>=1.20.0"
    ],
    "npm": [
      "react>=18.0.0",
      "recharts>=2.0.0"
    ]
  },
  "configuration": {
    "settings_schema": "config/settings.json",
    "default_config": "config/default.json"
  }
}
```

### Installation Script

```python
# install.py
#!/usr/bin/env python3
"""Plugin installation script."""

import json
import shutil
import sys
from pathlib import Path

def install_plugin():
    """Install the Chronicle plugin."""
    
    # Read plugin manifest
    manifest_path = Path(__file__).parent / "plugin.json"
    with open(manifest_path) as f:
        manifest = json.load(f)
    
    plugin_name = manifest["name"]
    
    # Chronicle installation directory
    chronicle_dir = Path.home() / ".claude" / "hooks" / "chronicle"
    plugins_dir = chronicle_dir / "plugins" / plugin_name
    
    # Create plugin directory
    plugins_dir.mkdir(parents=True, exist_ok=True)
    
    # Copy plugin files
    plugin_source = Path(__file__).parent / "my_plugin"
    shutil.copytree(plugin_source, plugins_dir, dirs_exist_ok=True)
    
    # Install dependencies
    install_dependencies(manifest.get("dependencies", {}))
    
    # Register plugin with Chronicle
    register_plugin(chronicle_dir, manifest)
    
    print(f"Plugin '{plugin_name}' installed successfully!")

def install_dependencies(dependencies):
    """Install plugin dependencies.""" 
    import subprocess
    
    # Install Python dependencies
    python_deps = dependencies.get("python", [])
    if python_deps:
        subprocess.run([
            sys.executable, "-m", "pip", "install"
        ] + python_deps, check=True)
    
    # Install npm dependencies (if dashboard is running)
    npm_deps = dependencies.get("npm", [])
    if npm_deps:
        try:
            subprocess.run([
                "npm", "install"  
            ] + npm_deps, cwd="apps/dashboard", check=True)
        except subprocess.CalledProcessError:
            print("Warning: Could not install npm dependencies")

def register_plugin(chronicle_dir, manifest):
    """Register plugin with Chronicle configuration."""
    config_file = chronicle_dir / "config" / "plugins.json"
    
    if config_file.exists():
        with open(config_file) as f:
            config = json.load(f)
    else:
        config = {"plugins": []}
    
    # Add or update plugin registration
    plugin_config = {
        "name": manifest["name"],
        "version": manifest["version"],
        "enabled": True,
        "path": f"plugins/{manifest['name']}"
    }
    
    # Update existing or add new
    existing = next(
        (i for i, p in enumerate(config["plugins"]) if p["name"] == manifest["name"]),
        None
    )
    
    if existing is not None:
        config["plugins"][existing] = plugin_config
    else:
        config["plugins"].append(plugin_config)
    
    # Save configuration
    config_file.parent.mkdir(parents=True, exist_ok=True)
    with open(config_file, 'w') as f:
        json.dump(config, f, indent=2)

if __name__ == "__main__":
    install_plugin()
```

## Best Practices

### Plugin Development Guidelines

1. **Error Handling**: Always handle errors gracefully
2. **Performance**: Minimize impact on Chronicle performance
3. **Security**: Validate all inputs and sanitize outputs
4. **Compatibility**: Test with different Chronicle versions
5. **Documentation**: Provide clear installation and usage docs

### Code Quality

- Follow Chronicle's coding standards
- Include comprehensive tests
- Use TypeScript for dashboard components
- Add proper logging and error reporting
- Optimize for performance

### Plugin Lifecycle

1. **Development**: Create and test plugin locally
2. **Testing**: Comprehensive unit and integration tests
3. **Documentation**: User guides and API documentation
4. **Distribution**: Package for easy installation
5. **Maintenance**: Regular updates and bug fixes

## Plugin Registry

Chronicle plans to support a plugin registry where developers can publish and share plugins. The registry will include:

- Plugin discovery and search
- Version management and updates
- User ratings and reviews
- Installation statistics
- Security scanning

For more information about plugin development, see:
- [Contributing Guide](contributing.md)
- [API Reference](api-reference.md)
- [Architecture Guide](architecture.md)