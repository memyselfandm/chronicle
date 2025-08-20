# Data Sanitization & Security Guide for Chronicle

## Overview
This guide provides comprehensive data sanitization techniques and PII detection strategies for Chronicle's observability system. When handling user data, development contexts, and tool outputs, it's critical to automatically detect and sanitize sensitive information.

## PII Detection Strategies

### Common PII Patterns

#### Email Addresses
```python
import re

EMAIL_PATTERN = re.compile(
    r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
    re.IGNORECASE
)

def detect_emails(text):
    return EMAIL_PATTERN.findall(text)

def sanitize_emails(text):
    return EMAIL_PATTERN.sub('[EMAIL_REDACTED]', text)
```

#### Phone Numbers
```python
PHONE_PATTERNS = [
    re.compile(r'\b\d{3}-\d{3}-\d{4}\b'),  # 123-456-7890
    re.compile(r'\b\(\d{3}\)\s*\d{3}-\d{4}\b'),  # (123) 456-7890
    re.compile(r'\b\d{3}\.\d{3}\.\d{4}\b'),  # 123.456.7890
    re.compile(r'\b\+1\s*\d{3}\s*\d{3}\s*\d{4}\b'),  # +1 123 456 7890
]

def sanitize_phone_numbers(text):
    for pattern in PHONE_PATTERNS:
        text = pattern.sub('[PHONE_REDACTED]', text)
    return text
```

#### Social Security Numbers
```python
SSN_PATTERN = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')

def sanitize_ssn(text):
    return SSN_PATTERN.sub('[SSN_REDACTED]', text)
```

#### Credit Card Numbers
```python
CC_PATTERN = re.compile(r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b')

def sanitize_credit_cards(text):
    return CC_PATTERN.sub('[CC_REDACTED]', text)
```

### Advanced PII Detection Libraries

#### Using `presidio-analyzer`
```python
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

class PIIDetector:
    def __init__(self):
        self.analyzer = AnalyzerEngine()
        self.anonymizer = AnonymizerEngine()
    
    def detect_pii(self, text, language='en'):
        """Detect PII entities in text"""
        results = self.analyzer.analyze(
            text=text,
            entities=["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", 
                     "CREDIT_CARD", "CRYPTO", "IP_ADDRESS", "US_SSN"],
            language=language
        )
        return results
    
    def anonymize_text(self, text, language='en'):
        """Anonymize detected PII in text"""
        analyzer_results = self.detect_pii(text, language)
        anonymized = self.anonymizer.anonymize(
            text=text,
            analyzer_results=analyzer_results
        )
        return anonymized.text
```

#### Custom Pattern Detection
```python
import re
from typing import List, Dict, Tuple

class CustomPIIDetector:
    def __init__(self):
        self.patterns = {
            'api_key': re.compile(r'api_key["\s]*[:=]["\s]*([a-zA-Z0-9_-]{20,})', re.IGNORECASE),
            'bearer_token': re.compile(r'bearer\s+([a-zA-Z0-9_-]{20,})', re.IGNORECASE),
            'password': re.compile(r'password["\s]*[:=]["\s]*["\']([^"\']{8,})["\']', re.IGNORECASE),
            'private_key': re.compile(r'-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----.*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----', re.DOTALL),
            'aws_access_key': re.compile(r'AKIA[0-9A-Z]{16}'),
            'github_token': re.compile(r'ghp_[a-zA-Z0-9]{36}'),
            'slack_token': re.compile(r'xox[baprs]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}'),
        }
    
    def detect_secrets(self, text: str) -> Dict[str, List[str]]:
        """Detect various types of secrets and API keys"""
        found_secrets = {}
        for secret_type, pattern in self.patterns.items():
            matches = pattern.findall(text)
            if matches:
                found_secrets[secret_type] = matches
        return found_secrets
    
    def sanitize_secrets(self, text: str) -> str:
        """Replace detected secrets with redacted placeholders"""
        for secret_type, pattern in self.patterns.items():
            placeholder = f'[{secret_type.upper()}_REDACTED]'
            text = pattern.sub(placeholder, text)
        return text
```

## Data Sanitization Utilities

### Chronicle-Specific Sanitization
```python
import json
from typing import Any, Dict, List, Union

class ChronicleDataSanitizer:
    def __init__(self):
        self.pii_detector = CustomPIIDetector()
        self.file_path_pattern = re.compile(r'/(?:home|Users)/[^/\s]+', re.IGNORECASE)
        self.sensitive_keys = {
            'password', 'passwd', 'secret', 'key', 'token', 'auth',
            'credential', 'api_key', 'private_key', 'access_token'
        }
    
    def sanitize_file_paths(self, text: str) -> str:
        """Replace user home directories with generic placeholder"""
        return self.file_path_pattern.sub('/USER_HOME', text)
    
    def sanitize_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively sanitize dictionary data"""
        if not isinstance(data, dict):
            return data
        
        sanitized = {}
        for key, value in data.items():
            # Check if key indicates sensitive data
            if any(sensitive in key.lower() for sensitive in self.sensitive_keys):
                sanitized[key] = '[SENSITIVE_DATA_REDACTED]'
            elif isinstance(value, dict):
                sanitized[key] = self.sanitize_dict(value)
            elif isinstance(value, list):
                sanitized[key] = self.sanitize_list(value)
            elif isinstance(value, str):
                sanitized[key] = self.sanitize_text(value)
            else:
                sanitized[key] = value
        
        return sanitized
    
    def sanitize_list(self, data: List[Any]) -> List[Any]:
        """Recursively sanitize list data"""
        sanitized = []
        for item in data:
            if isinstance(item, dict):
                sanitized.append(self.sanitize_dict(item))
            elif isinstance(item, list):
                sanitized.append(self.sanitize_list(item))
            elif isinstance(item, str):
                sanitized.append(self.sanitize_text(item))
            else:
                sanitized.append(item)
        return sanitized
    
    def sanitize_text(self, text: str) -> str:
        """Apply all text sanitization rules"""
        if not isinstance(text, str):
            return text
        
        # Apply PII detection and sanitization
        text = sanitize_emails(text)
        text = sanitize_phone_numbers(text)
        text = sanitize_ssn(text)
        text = sanitize_credit_cards(text)
        
        # Apply secret detection
        text = self.pii_detector.sanitize_secrets(text)
        
        # Sanitize file paths
        text = self.sanitize_file_paths(text)
        
        return text
    
    def sanitize_tool_input(self, tool_data: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize tool input parameters"""
        return self.sanitize_dict(tool_data)
    
    def sanitize_tool_output(self, tool_output: str) -> str:
        """Sanitize tool output content"""
        return self.sanitize_text(tool_output)
```

## Secure Logging Patterns

### Structured Logging with Sanitization
```python
import logging
import json
from datetime import datetime
from typing import Any, Dict

class SecureLogger:
    def __init__(self, logger_name: str):
        self.logger = logging.getLogger(logger_name)
        self.sanitizer = ChronicleDataSanitizer()
    
    def log_event(self, event_type: str, data: Dict[str, Any], level: str = 'INFO'):
        """Log events with automatic data sanitization"""
        sanitized_data = self.sanitizer.sanitize_dict(data)
        
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'event_type': event_type,
            'data': sanitized_data,
            'sanitized': True
        }
        
        log_message = json.dumps(log_entry, default=str)
        
        if level.upper() == 'ERROR':
            self.logger.error(log_message)
        elif level.upper() == 'WARNING':
            self.logger.warning(log_message)
        elif level.upper() == 'DEBUG':
            self.logger.debug(log_message)
        else:
            self.logger.info(log_message)
    
    def log_tool_execution(self, tool_name: str, inputs: Dict[str, Any], 
                          outputs: Any, execution_time: float):
        """Log tool execution with sanitization"""
        self.log_event('tool_execution', {
            'tool_name': tool_name,
            'inputs': inputs,
            'outputs': str(outputs)[:1000] if outputs else None,  # Truncate large outputs
            'execution_time_ms': execution_time * 1000
        })
```

## Configuration-Based Sanitization

### Sanitization Rules Configuration
```python
from dataclasses import dataclass
from typing import List, Dict, Optional
import yaml

@dataclass
class SanitizationConfig:
    enable_pii_detection: bool = True
    enable_secret_detection: bool = True
    enable_file_path_sanitization: bool = True
    custom_patterns: Dict[str, str] = None
    sensitive_keys: List[str] = None
    max_text_length: int = 10000
    truncate_large_outputs: bool = True
    
    @classmethod
    def from_file(cls, config_path: str) -> 'SanitizationConfig':
        """Load sanitization configuration from YAML file"""
        with open(config_path, 'r') as f:
            config_data = yaml.safe_load(f)
        return cls(**config_data)

class ConfigurableSanitizer:
    def __init__(self, config: SanitizationConfig):
        self.config = config
        self.base_sanitizer = ChronicleDataSanitizer()
        
        # Add custom patterns if configured
        if config.custom_patterns:
            for name, pattern in config.custom_patterns.items():
                self.base_sanitizer.pii_detector.patterns[name] = re.compile(pattern)
        
        # Update sensitive keys if configured
        if config.sensitive_keys:
            self.base_sanitizer.sensitive_keys.update(config.sensitive_keys)
    
    def sanitize(self, data: Any) -> Any:
        """Apply configured sanitization rules"""
        if not self.config.enable_pii_detection and not self.config.enable_secret_detection:
            return data
        
        if isinstance(data, dict):
            return self.base_sanitizer.sanitize_dict(data)
        elif isinstance(data, str):
            text = data
            if self.config.max_text_length and len(text) > self.config.max_text_length:
                text = text[:self.config.max_text_length] + '[TRUNCATED]'
            return self.base_sanitizer.sanitize_text(text)
        else:
            return data
```

## Real-time Sanitization Pipeline

### Stream Processing for Live Data
```python
import asyncio
from typing import AsyncGenerator, Dict, Any

class SanitizationPipeline:
    def __init__(self, config: SanitizationConfig):
        self.sanitizer = ConfigurableSanitizer(config)
        self.processing_queue = asyncio.Queue()
    
    async def process_stream(self, data_stream: AsyncGenerator[Dict[str, Any], None]):
        """Process streaming data with sanitization"""
        async for data_item in data_stream:
            sanitized_item = self.sanitizer.sanitize(data_item)
            await self.processing_queue.put(sanitized_item)
    
    async def get_sanitized_data(self) -> Dict[str, Any]:
        """Get sanitized data from processing queue"""
        return await self.processing_queue.get()
```

## Testing Sanitization

### Unit Tests for Sanitization
```python
import unittest

class TestDataSanitization(unittest.TestCase):
    def setUp(self):
        self.sanitizer = ChronicleDataSanitizer()
    
    def test_email_sanitization(self):
        text = "Contact me at john.doe@example.com for details"
        result = self.sanitizer.sanitize_text(text)
        self.assertNotIn("john.doe@example.com", result)
        self.assertIn("[EMAIL_REDACTED]", result)
    
    def test_api_key_sanitization(self):
        data = {"api_key": "sk-1234567890abcdef1234567890abcdef"}
        result = self.sanitizer.sanitize_dict(data)
        self.assertEqual(result["api_key"], "[SENSITIVE_DATA_REDACTED]")
    
    def test_file_path_sanitization(self):
        text = "/Users/johndoe/documents/secret.txt"
        result = self.sanitizer.sanitize_text(text)
        self.assertIn("/USER_HOME/documents/secret.txt", result)
```

## Best Practices

### 1. Sanitization Strategy
- Apply sanitization at data ingestion points
- Use multiple sanitization layers (input, processing, output)
- Regularly update PII detection patterns
- Monitor sanitization effectiveness

### 2. Performance Considerations
- Cache compiled regex patterns
- Use async processing for large datasets
- Implement batch sanitization for bulk operations
- Consider memory usage with large text processing

### 3. Security Guidelines
- Never log original sensitive data, even temporarily
- Use secure deletion for temporary files containing PII
- Implement sanitization verification checks
- Regular security audits of sanitization rules

### 4. Compliance Requirements
- Document all sanitization procedures
- Maintain audit logs of sanitization activities
- Implement data retention policies
- Ensure sanitization meets regulatory requirements (GDPR, CCPA, etc.)