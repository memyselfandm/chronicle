# MCP Tool Detection and Classification Documentation

## Overview

This documentation covers the Model Context Protocol (MCP) tool detection, classification, and pattern matching for observability systems. MCP provides standardized patterns for identifying and categorizing AI tools and their capabilities.

## MCP Protocol Fundamentals

### Core Architecture

The Model Context Protocol follows a client-host-server architecture where:
- **MCP Clients** connect to MCP servers on behalf of applications
- **MCP Servers** expose resources, tools, and prompts
- **Transport Layer** handles communication via JSON-RPC 2.0

### Tool Classification Categories

MCP defines three core primitives for tool classification:

1. **Tools (Model-controlled)** - Functions that LLMs can invoke to perform actions
2. **Resources (Application-controlled)** - Data sources that provide context
3. **Prompts (User-controlled)** - Pre-defined interaction templates

## MCP Tool Detection Patterns

### 1. Tool Naming Convention Detection

MCP tools follow specific naming patterns that can be detected programmatically:

```python
import re
from typing import Dict, List, Optional, Tuple
from enum import Enum

class MCPToolType(Enum):
    MCP_SERVER_TOOL = "mcp_server_tool"
    STANDARD_TOOL = "standard_tool"
    RESOURCE_TOOL = "resource_tool"
    PROMPT_TOOL = "prompt_tool"

class MCPToolDetector:
    """Detect and classify MCP tools based on naming patterns and metadata"""
    
    def __init__(self):
        # MCP tool naming patterns
        self.mcp_patterns = {
            MCPToolType.MCP_SERVER_TOOL: re.compile(r'^mcp__([^_]+)__(.+)$'),
            MCPToolType.RESOURCE_TOOL: re.compile(r'.*_(read|get|fetch|list)_.*'),
            MCPToolType.PROMPT_TOOL: re.compile(r'.*_(prompt|template|generate)_.*'),
        }
        
    def detect_tool_type(self, tool_name: str) -> Tuple[MCPToolType, Dict[str, str]]:
        """
        Detect MCP tool type and extract metadata from tool name
        
        Returns:
            Tuple of (tool_type, metadata_dict)
        """
        metadata = {}
        
        # Check for MCP server tool pattern (mcp__server__tool)
        mcp_match = self.mcp_patterns[MCPToolType.MCP_SERVER_TOOL].match(tool_name)
        if mcp_match:
            metadata.update({
                'server_name': mcp_match.group(1),
                'tool_name': mcp_match.group(2),
                'protocol': 'mcp',
                'pattern': 'mcp__server__tool'
            })
            return MCPToolType.MCP_SERVER_TOOL, metadata
        
        # Check for resource tool patterns
        if self.mcp_patterns[MCPToolType.RESOURCE_TOOL].match(tool_name):
            metadata.update({
                'tool_name': tool_name,
                'capability': 'resource_access',
                'side_effects': False
            })
            return MCPToolType.RESOURCE_TOOL, metadata
        
        # Check for prompt tool patterns
        if self.mcp_patterns[MCPToolType.PROMPT_TOOL].match(tool_name):
            metadata.update({
                'tool_name': tool_name,
                'capability': 'prompt_template',
                'user_controlled': True
            })
            return MCPToolType.PROMPT_TOOL, metadata
        
        # Default to standard tool
        metadata.update({
            'tool_name': tool_name,
            'protocol': 'standard'
        })
        return MCPToolType.STANDARD_TOOL, metadata
```

### 2. MCP Protocol Message Detection

```python
import json
from typing import Any, Dict, Optional

class MCPMessageDetector:
    """Detect MCP protocol messages and extract tool information"""
    
    MCP_METHODS = {
        'tools/list': 'tool_listing',
        'tools/call': 'tool_execution',
        'resources/list': 'resource_listing',
        'resources/read': 'resource_access',
        'prompts/list': 'prompt_listing',
        'prompts/get': 'prompt_access'
    }
    
    def detect_mcp_message(self, message: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Detect if a message follows MCP protocol structure
        
        Returns:
            MCP message metadata or None if not MCP
        """
        if not isinstance(message, dict):
            return None
            
        # Check for JSON-RPC 2.0 structure
        if message.get('jsonrpc') != '2.0':
            return None
            
        method = message.get('method')
        if not method:
            return None
            
        # Check if method matches MCP patterns
        if method in self.MCP_METHODS:
            return {
                'protocol': 'mcp',
                'method': method,
                'operation_type': self.MCP_METHODS[method],
                'message_id': message.get('id'),
                'params': message.get('params', {}),
                'is_mcp': True
            }
        
        # Check for MCP-style method patterns
        if method.startswith(('tools/', 'resources/', 'prompts/')):
            return {
                'protocol': 'mcp',
                'method': method,
                'operation_type': 'custom_mcp',
                'message_id': message.get('id'),
                'params': message.get('params', {}),
                'is_mcp': True
            }
        
        return None
```

### 3. Tool Capability Classification

```python
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set

@dataclass
class MCPToolCapability:
    """Represents MCP tool capabilities and characteristics"""
    name: str
    type: MCPToolType
    has_side_effects: bool
    requires_user_input: bool
    data_access_level: str  # 'read', 'write', 'admin'
    resource_types: Set[str]
    security_level: str  # 'low', 'medium', 'high'

class MCPToolClassifier:
    """Classify MCP tools based on their capabilities and metadata"""
    
    def __init__(self):
        self.detector = MCPToolDetector()
        
        # Predefined capability patterns
        self.capability_patterns = {
            'file_operations': {
                'patterns': ['read', 'write', 'edit', 'create', 'delete', 'ls', 'glob'],
                'side_effects': True,
                'security_level': 'high'
            },
            'network_operations': {
                'patterns': ['fetch', 'request', 'download', 'upload', 'web'],
                'side_effects': True,
                'security_level': 'medium'
            },
            'data_analysis': {
                'patterns': ['analyze', 'process', 'compute', 'calculate'],
                'side_effects': False,
                'security_level': 'low'
            },
            'system_operations': {
                'patterns': ['bash', 'execute', 'run', 'shell', 'command'],
                'side_effects': True,
                'security_level': 'high'
            }
        }
    
    def classify_tool(self, tool_name: str, tool_schema: Optional[Dict] = None) -> MCPToolCapability:
        """
        Classify a tool based on name and optional schema information
        
        Args:
            tool_name: Name of the tool
            tool_schema: Optional tool schema with parameters and description
            
        Returns:
            MCPToolCapability object with classification details
        """
        tool_type, metadata = self.detector.detect_tool_type(tool_name)
        
        # Analyze tool name for capability patterns
        capabilities = self._analyze_capabilities(tool_name.lower())
        
        # Extract additional info from schema if available
        if tool_schema:
            capabilities.update(self._analyze_schema_capabilities(tool_schema))
        
        # Determine security level and side effects
        security_level = self._determine_security_level(capabilities)
        has_side_effects = self._has_side_effects(capabilities)
        
        return MCPToolCapability(
            name=tool_name,
            type=tool_type,
            has_side_effects=has_side_effects,
            requires_user_input=self._requires_user_input(tool_schema),
            data_access_level=self._determine_access_level(capabilities),
            resource_types=set(capabilities.get('resource_types', [])),
            security_level=security_level
        )
    
    def _analyze_capabilities(self, tool_name: str) -> Dict[str, Any]:
        """Analyze tool name for capability indicators"""
        capabilities = {
            'detected_patterns': [],
            'resource_types': []
        }
        
        for category, config in self.capability_patterns.items():
            for pattern in config['patterns']:
                if pattern in tool_name:
                    capabilities['detected_patterns'].append(category)
                    break
        
        return capabilities
    
    def _analyze_schema_capabilities(self, schema: Dict) -> Dict[str, Any]:
        """Extract capabilities from tool schema"""
        capabilities = {}
        
        description = schema.get('description', '').lower()
        parameters = schema.get('parameters', {})
        
        # Check for file path parameters
        if any('path' in param or 'file' in param for param in parameters.get('properties', {})):
            capabilities.setdefault('resource_types', []).append('file_system')
        
        # Check for URL parameters
        if any('url' in param or 'endpoint' in param for param in parameters.get('properties', {})):
            capabilities.setdefault('resource_types', []).append('network')
        
        # Check for database parameters
        if any('db' in param or 'sql' in param or 'query' in param for param in parameters.get('properties', {})):
            capabilities.setdefault('resource_types', []).append('database')
        
        return capabilities
    
    def _determine_security_level(self, capabilities: Dict) -> str:
        """Determine security level based on capabilities"""
        detected_patterns = capabilities.get('detected_patterns', [])
        
        high_risk = ['file_operations', 'system_operations']
        medium_risk = ['network_operations']
        
        if any(pattern in detected_patterns for pattern in high_risk):
            return 'high'
        elif any(pattern in detected_patterns for pattern in medium_risk):
            return 'medium'
        else:
            return 'low'
    
    def _has_side_effects(self, capabilities: Dict) -> bool:
        """Determine if tool has side effects"""
        detected_patterns = capabilities.get('detected_patterns', [])
        
        side_effect_patterns = []
        for category, config in self.capability_patterns.items():
            if config.get('side_effects', False):
                side_effect_patterns.append(category)
        
        return any(pattern in detected_patterns for pattern in side_effect_patterns)
    
    def _requires_user_input(self, schema: Optional[Dict]) -> bool:
        """Check if tool requires user input"""
        if not schema:
            return False
        
        parameters = schema.get('parameters', {})
        required_params = parameters.get('required', [])
        
        # Check for parameters that typically require user input
        user_input_indicators = ['message', 'query', 'input', 'prompt', 'content']
        
        for param in required_params:
            if any(indicator in param.lower() for indicator in user_input_indicators):
                return True
        
        return False
    
    def _determine_access_level(self, capabilities: Dict) -> str:
        """Determine data access level"""
        detected_patterns = capabilities.get('detected_patterns', [])
        
        if 'system_operations' in detected_patterns:
            return 'admin'
        elif any(pattern in detected_patterns for pattern in ['file_operations']):
            return 'write'
        else:
            return 'read'
```

## Pattern Matching for Tool Identification

### 1. Regex-Based Pattern Matching

```python
import re
from typing import Dict, List, Pattern

class MCPPatternMatcher:
    """Advanced pattern matching for MCP tool identification"""
    
    def __init__(self):
        self.compiled_patterns = self._compile_patterns()
    
    def _compile_patterns(self) -> Dict[str, Dict[str, Pattern]]:
        """Compile regex patterns for efficient matching"""
        return {
            'mcp_server_tools': {
                'standard': re.compile(r'^mcp__(\w+)__(\w+)$'),
                'nested': re.compile(r'^mcp__(\w+)__(\w+)__(\w+)$'),
                'versioned': re.compile(r'^mcp__(\w+)_v(\d+)__(\w+)$')
            },
            'capability_indicators': {
                'file_ops': re.compile(r'.*(read|write|edit|create|delete|move|copy).*file.*', re.IGNORECASE),
                'network_ops': re.compile(r'.*(fetch|request|download|upload|http|api).*', re.IGNORECASE),
                'database_ops': re.compile(r'.*(query|insert|update|delete|select).*', re.IGNORECASE),
                'system_ops': re.compile(r'.*(execute|run|shell|bash|command).*', re.IGNORECASE)
            },
            'data_sensitivity': {
                'credentials': re.compile(r'.*(password|token|key|secret|auth).*', re.IGNORECASE),
                'pii': re.compile(r'.*(email|phone|ssn|address|name).*', re.IGNORECASE),
                'financial': re.compile(r'.*(payment|card|account|bank).*', re.IGNORECASE)
            }
        }
    
    def match_tool_patterns(self, tool_name: str) -> Dict[str, Any]:
        """Match tool against all pattern categories"""
        results = {
            'mcp_info': {},
            'capabilities': [],
            'security_flags': [],
            'confidence_score': 0.0
        }
        
        # Check MCP server tool patterns
        for pattern_name, pattern in self.compiled_patterns['mcp_server_tools'].items():
            match = pattern.match(tool_name)
            if match:
                results['mcp_info'] = {
                    'pattern_type': pattern_name,
                    'groups': match.groups(),
                    'is_mcp_tool': True
                }
                results['confidence_score'] += 0.4
                break
        
        # Check capability patterns
        for capability, pattern in self.compiled_patterns['capability_indicators'].items():
            if pattern.search(tool_name):
                results['capabilities'].append(capability)
                results['confidence_score'] += 0.2
        
        # Check security-sensitive patterns
        for sensitivity_type, pattern in self.compiled_patterns['data_sensitivity'].items():
            if pattern.search(tool_name):
                results['security_flags'].append(sensitivity_type)
                results['confidence_score'] += 0.1
        
        return results
```

### 2. Fuzzy Matching for Tool Discovery

```python
from difflib import SequenceMatcher
from typing import List, Tuple

class MCPFuzzyMatcher:
    """Fuzzy matching for tool discovery and classification"""
    
    def __init__(self):
        self.known_mcp_tools = [
            'mcp__server__read',
            'mcp__server__write',
            'mcp__server__execute',
            'mcp__filesystem__list',
            'mcp__database__query',
            'mcp__api__fetch'
        ]
        
        self.tool_categories = {
            'file_operations': ['read', 'write', 'edit', 'create', 'delete', 'list', 'move'],
            'network_operations': ['fetch', 'download', 'upload', 'request', 'api'],
            'data_operations': ['query', 'search', 'analyze', 'process', 'transform'],
            'system_operations': ['execute', 'run', 'bash', 'shell', 'command']
        }
    
    def find_similar_tools(self, tool_name: str, threshold: float = 0.6) -> List[Tuple[str, float]]:
        """Find similar known MCP tools"""
        similarities = []
        
        for known_tool in self.known_mcp_tools:
            similarity = SequenceMatcher(None, tool_name.lower(), known_tool.lower()).ratio()
            if similarity >= threshold:
                similarities.append((known_tool, similarity))
        
        return sorted(similarities, key=lambda x: x[1], reverse=True)
    
    def categorize_by_similarity(self, tool_name: str) -> Dict[str, float]:
        """Categorize tool based on similarity to known patterns"""
        category_scores = {}
        
        tool_words = set(tool_name.lower().split('_'))
        
        for category, keywords in self.tool_categories.items():
            # Calculate similarity score based on keyword overlap
            keyword_matches = sum(1 for keyword in keywords if keyword in tool_words)
            category_scores[category] = keyword_matches / len(keywords) if keywords else 0.0
        
        return category_scores
```

## Tool Schema Analysis

### Schema-Based Classification

```python
from typing import Any, Dict, List, Optional

class MCPSchemaAnalyzer:
    """Analyze MCP tool schemas for classification and security assessment"""
    
    def analyze_tool_schema(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Comprehensive analysis of tool schema"""
        analysis = {
            'parameter_analysis': self._analyze_parameters(schema.get('parameters', {})),
            'security_assessment': self._assess_security(schema),
            'capability_inference': self._infer_capabilities(schema),
            'compliance_check': self._check_compliance(schema)
        }
        
        return analysis
    
    def _analyze_parameters(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze tool parameters for classification hints"""
        properties = parameters.get('properties', {})
        required = parameters.get('required', [])
        
        analysis = {
            'total_params': len(properties),
            'required_params': len(required),
            'parameter_types': {},
            'sensitive_params': [],
            'file_path_params': [],
            'url_params': []
        }
        
        for param_name, param_def in properties.items():
            param_type = param_def.get('type', 'unknown')
            analysis['parameter_types'][param_type] = analysis['parameter_types'].get(param_type, 0) + 1
            
            # Check for sensitive parameters
            if any(sensitive in param_name.lower() for sensitive in ['password', 'token', 'key', 'secret']):
                analysis['sensitive_params'].append(param_name)
            
            # Check for file path parameters
            if any(path_indicator in param_name.lower() for path_indicator in ['path', 'file', 'directory']):
                analysis['file_path_params'].append(param_name)
            
            # Check for URL parameters
            if any(url_indicator in param_name.lower() for url_indicator in ['url', 'endpoint', 'uri']):
                analysis['url_params'].append(param_name)
        
        return analysis
    
    def _assess_security(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Assess security implications of the tool"""
        description = schema.get('description', '').lower()
        parameters = schema.get('parameters', {})
        
        security_flags = []
        risk_level = 'low'
        
        # Check for high-risk operations
        high_risk_indicators = ['execute', 'delete', 'remove', 'system', 'shell', 'admin']
        if any(indicator in description for indicator in high_risk_indicators):
            security_flags.append('high_risk_operation')
            risk_level = 'high'
        
        # Check for network access
        if any(net_indicator in description for net_indicator in ['network', 'internet', 'download', 'upload']):
            security_flags.append('network_access')
            if risk_level == 'low':
                risk_level = 'medium'
        
        # Check for file system access
        if any(fs_indicator in description for fs_indicator in ['file', 'directory', 'path', 'read', 'write']):
            security_flags.append('filesystem_access')
            if risk_level == 'low':
                risk_level = 'medium'
        
        return {
            'risk_level': risk_level,
            'security_flags': security_flags,
            'requires_permission': len(security_flags) > 0
        }
    
    def _infer_capabilities(self, schema: Dict[str, Any]) -> List[str]:
        """Infer tool capabilities from schema"""
        description = schema.get('description', '').lower()
        capabilities = []
        
        capability_keywords = {
            'data_processing': ['process', 'analyze', 'transform', 'parse'],
            'file_operations': ['read', 'write', 'create', 'delete', 'modify'],
            'network_operations': ['fetch', 'request', 'download', 'upload'],
            'system_integration': ['execute', 'run', 'command', 'shell'],
            'user_interaction': ['prompt', 'input', 'interactive', 'dialog']
        }
        
        for capability, keywords in capability_keywords.items():
            if any(keyword in description for keyword in keywords):
                capabilities.append(capability)
        
        return capabilities
    
    def _check_compliance(self, schema: Dict[str, Any]) -> Dict[str, bool]:
        """Check schema compliance with MCP standards"""
        return {
            'has_description': bool(schema.get('description')),
            'has_parameters': 'parameters' in schema,
            'parameters_well_formed': self._validate_parameters_structure(schema.get('parameters', {})),
            'follows_naming_convention': self._check_naming_convention(schema)
        }
    
    def _validate_parameters_structure(self, parameters: Dict[str, Any]) -> bool:
        """Validate parameters follow JSON Schema structure"""
        if not isinstance(parameters, dict):
            return False
        
        # Check for required JSON Schema fields
        required_fields = ['type', 'properties']
        return all(field in parameters for field in required_fields if parameters)
    
    def _check_naming_convention(self, schema: Dict[str, Any]) -> bool:
        """Check if tool follows MCP naming conventions"""
        # This would implement specific MCP naming convention checks
        return True  # Placeholder implementation
```

## Integration with Observability Systems

### Hook Integration for MCP Detection

```python
class MCPObservabilityHook:
    """Integration hook for MCP tool detection in observability systems"""
    
    def __init__(self):
        self.classifier = MCPToolClassifier()
        self.pattern_matcher = MCPPatternMatcher()
        self.schema_analyzer = MCPSchemaAnalyzer()
    
    def analyze_tool_execution(self, tool_name: str, parameters: Dict, tool_schema: Optional[Dict] = None) -> Dict[str, Any]:
        """Comprehensive analysis for observability systems"""
        
        # Basic classification
        capability = self.classifier.classify_tool(tool_name, tool_schema)
        
        # Pattern matching
        pattern_results = self.pattern_matcher.match_tool_patterns(tool_name)
        
        # Schema analysis if available
        schema_analysis = None
        if tool_schema:
            schema_analysis = self.schema_analyzer.analyze_tool_schema(tool_schema)
        
        return {
            'tool_name': tool_name,
            'mcp_classification': {
                'type': capability.type.value,
                'has_side_effects': capability.has_side_effects,
                'security_level': capability.security_level,
                'data_access_level': capability.data_access_level,
                'resource_types': list(capability.resource_types)
            },
            'pattern_analysis': pattern_results,
            'schema_analysis': schema_analysis,
            'observability_metadata': {
                'should_monitor_closely': capability.security_level == 'high',
                'requires_audit_logging': capability.has_side_effects,
                'sensitive_data_risk': len(pattern_results.get('security_flags', [])) > 0
            }
        }
```

This documentation provides comprehensive coverage of MCP tool detection and classification patterns, enabling robust observability systems to identify, categorize, and monitor MCP tools effectively.