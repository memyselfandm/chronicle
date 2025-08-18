"""
Cross-Platform Compatibility Utilities

This module provides utilities for handling cross-platform compatibility 
issues in Chronicle hooks, particularly around path handling, environment 
variables, and filesystem operations.

Supported platforms:
- Windows (Windows 10+)
- macOS (macOS 10.15+) 
- Linux (Ubuntu 18.04+, RHEL 7+, etc.)
"""

import os
import platform
import stat
from pathlib import Path, PurePath, PurePosixPath, PureWindowsPath
from typing import Optional, Union, List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class PlatformInfo:
    """Information about the current platform."""
    
    def __init__(self):
        self.system = platform.system()
        self.platform = platform.platform()
        self.machine = platform.machine()
        self.python_version = platform.python_version()
        self.is_windows = self.system == "Windows"
        self.is_macos = self.system == "Darwin"
        self.is_linux = self.system == "Linux"
        self.is_unix_like = self.is_macos or self.is_linux
        
    def __str__(self):
        return f"{self.system} ({self.platform})"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging/serialization."""
        return {
            "system": self.system,
            "platform": self.platform,
            "machine": self.machine,
            "python_version": self.python_version,
            "is_windows": self.is_windows,
            "is_macos": self.is_macos,
            "is_linux": self.is_linux,
            "is_unix_like": self.is_unix_like,
        }


# Global platform info instance
PLATFORM = PlatformInfo()


def normalize_path(path: Union[str, Path]) -> str:
    """
    Normalize a path for the current platform.
    
    Args:
        path: Path to normalize
        
    Returns:
        Normalized path string
    """
    if isinstance(path, str):
        path = Path(path)
    
    # Resolve to absolute path and normalize
    try:
        # Handle different path types appropriately
        if PLATFORM.is_windows:
            # On Windows, ensure we handle both forward and back slashes
            normalized = path.resolve()
        else:
            # On Unix-like systems, use standard resolution
            normalized = path.resolve()
        
        return str(normalized)
    except (OSError, ValueError) as e:
        logger.warning(f"Failed to normalize path {path}: {e}")
        # Fall back to string conversion
        return str(path)


def safe_path_join(*parts: Union[str, Path]) -> str:
    """
    Safely join path parts across platforms.
    
    Args:
        *parts: Path parts to join
        
    Returns:
        Joined path string
    """
    if not parts:
        return ""
    
    try:
        # Convert all parts to Path objects and join
        path_parts = [Path(part) for part in parts if part]
        if not path_parts:
            return ""
        
        joined = path_parts[0]
        for part in path_parts[1:]:
            joined = joined / part
        
        return str(joined)
    except (TypeError, ValueError) as e:
        logger.warning(f"Failed to join path parts {parts}: {e}")
        # Fall back to simple string joining with OS separator
        return os.sep.join(str(part) for part in parts if part)


def is_absolute_path(path: Union[str, Path]) -> bool:
    """
    Check if a path is absolute across platforms.
    
    Args:
        path: Path to check
        
    Returns:
        True if path is absolute
    """
    try:
        path_obj = Path(path)
        return path_obj.is_absolute()
    except (TypeError, ValueError):
        # Fall back to string-based check
        path_str = str(path)
        
        if PLATFORM.is_windows:
            # Windows absolute paths start with drive letter or UNC
            return (len(path_str) >= 2 and path_str[1] == ':') or path_str.startswith('\\\\')
        else:
            # Unix-like absolute paths start with /
            return path_str.startswith('/')


def ensure_directory_exists(directory: Union[str, Path], mode: Optional[int] = None) -> bool:
    """
    Ensure a directory exists, creating it if necessary.
    
    Args:
        directory: Directory path to ensure exists
        mode: Optional file mode (Unix only)
        
    Returns:
        True if directory exists or was created successfully
    """
    try:
        dir_path = Path(directory)
        
        if dir_path.exists():
            if dir_path.is_dir():
                return True
            else:
                logger.error(f"Path exists but is not a directory: {directory}")
                return False
        
        # Create directory with parents
        dir_path.mkdir(parents=True, exist_ok=True)
        
        # Set permissions on Unix-like systems
        if mode is not None and PLATFORM.is_unix_like:
            try:
                dir_path.chmod(mode)
            except OSError as e:
                logger.warning(f"Failed to set directory permissions for {directory}: {e}")
        
        logger.debug(f"Created directory: {directory}")
        return True
        
    except (OSError, PermissionError) as e:
        logger.error(f"Failed to create directory {directory}: {e}")
        return False


def is_path_writable(path: Union[str, Path]) -> bool:
    """
    Check if a path is writable across platforms.
    
    Args:
        path: Path to check
        
    Returns:
        True if path is writable
    """
    try:
        path_obj = Path(path)
        
        if path_obj.exists():
            # Check existing path
            return os.access(path_obj, os.W_OK)
        else:
            # Check parent directory
            parent = path_obj.parent
            if parent.exists():
                return os.access(parent, os.W_OK)
            else:
                # Recursively check parent directories
                return is_path_writable(parent)
                
    except (OSError, PermissionError):
        return False


def make_executable(file_path: Union[str, Path]) -> bool:
    """
    Make a file executable across platforms.
    
    Args:
        file_path: Path to file to make executable
        
    Returns:
        True if file was made executable successfully
    """
    try:
        path_obj = Path(file_path)
        
        if not path_obj.exists():
            logger.error(f"Cannot make non-existent file executable: {file_path}")
            return False
        
        if PLATFORM.is_windows:
            # On Windows, files are executable by default if they have appropriate extensions
            # or if they're in the PATH. We don't need to change permissions.
            return True
        else:
            # On Unix-like systems, set execute permissions
            current_mode = path_obj.stat().st_mode
            new_mode = current_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH
            path_obj.chmod(new_mode)
            logger.debug(f"Made file executable: {file_path}")
            return True
            
    except (OSError, PermissionError) as e:
        logger.error(f"Failed to make file executable {file_path}: {e}")
        return False


def expand_environment_variables(path: str) -> str:
    """
    Expand environment variables in a path across platforms.
    
    Args:
        path: Path potentially containing environment variables
        
    Returns:
        Path with environment variables expanded
    """
    try:
        # Handle both Unix-style ($VAR, ${VAR}) and Windows-style (%VAR%)
        expanded = os.path.expandvars(path)
        
        # Also handle user home directory expansion
        expanded = os.path.expanduser(expanded)
        
        return expanded
    except Exception as e:
        logger.warning(f"Failed to expand environment variables in path {path}: {e}")
        return path


def get_temp_directory() -> str:
    """
    Get the appropriate temporary directory for the platform.
    
    Returns:
        Path to temporary directory
    """
    try:
        if PLATFORM.is_windows:
            # On Windows, prefer TEMP or TMP environment variables
            temp_dir = os.getenv('TEMP') or os.getenv('TMP') or r'C:\Windows\Temp'
        else:
            # On Unix-like systems, use /tmp or TMPDIR
            temp_dir = os.getenv('TMPDIR') or '/tmp'
        
        # Ensure the directory exists and is writable
        temp_path = Path(temp_dir)
        if temp_path.exists() and is_path_writable(temp_path):
            return str(temp_path)
        else:
            # Fall back to Python's standard temp directory
            import tempfile
            return tempfile.gettempdir()
            
    except Exception as e:
        logger.warning(f"Failed to get temp directory: {e}")
        import tempfile
        return tempfile.gettempdir()


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename to be safe across platforms.
    
    Args:
        filename: Original filename
        
    Returns:
        Sanitized filename safe for the current platform
    """
    # Characters that are problematic on various platforms
    if PLATFORM.is_windows:
        # Windows has more restrictive filename rules
        invalid_chars = r'<>:"/\|?*'
        reserved_names = {
            'CON', 'PRN', 'AUX', 'NUL',
            'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
            'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
        }
    else:
        # Unix-like systems are more permissive
        invalid_chars = r'/\0'
        reserved_names = set()
    
    # Replace invalid characters with underscore
    sanitized = filename
    for char in invalid_chars:
        sanitized = sanitized.replace(char, '_')
    
    # Handle reserved names on Windows
    if PLATFORM.is_windows:
        base_name = sanitized.split('.')[0].upper()
        if base_name in reserved_names:
            sanitized = f"_{sanitized}"
    
    # Ensure filename is not empty and not just dots
    if not sanitized or sanitized.strip('.') == '':
        sanitized = 'unnamed_file'
    
    # Limit length (most filesystems support at least 255 characters)
    max_length = 255
    if len(sanitized) > max_length:
        name, ext = os.path.splitext(sanitized)
        name = name[:max_length - len(ext) - 3] + '...'
        sanitized = name + ext
    
    return sanitized


def get_user_home_directory() -> str:
    """
    Get the user's home directory across platforms.
    
    Returns:
        Path to user's home directory
    """
    try:
        if PLATFORM.is_windows:
            # On Windows, use USERPROFILE or fall back to HOMEDRIVE + HOMEPATH
            home = os.getenv('USERPROFILE')
            if not home:
                drive = os.getenv('HOMEDRIVE', 'C:')
                path = os.getenv('HOMEPATH', r'\Users\Default')
                home = drive + path
        else:
            # On Unix-like systems, use HOME environment variable
            home = os.getenv('HOME')
            if not home:
                # Fall back to /tmp if HOME is not set
                home = '/tmp'
        
        return str(Path(home).resolve())
    except Exception as e:
        logger.warning(f"Failed to get user home directory: {e}")
        # Ultimate fallback
        return str(Path.home())


def validate_path_security(path: Union[str, Path]) -> Dict[str, Any]:
    """
    Validate a path for security concerns across platforms.
    
    Args:
        path: Path to validate
        
    Returns:
        Dictionary with validation results
    """
    result = {
        "is_safe": True,
        "warnings": [],
        "errors": [],
    }
    
    try:
        path_str = str(path)
        path_obj = Path(path)
        
        # Check for directory traversal attempts
        if '..' in path_str:
            result["warnings"].append("Path contains '..' which could indicate directory traversal")
        
        # Check for null bytes
        if '\0' in path_str:
            result["errors"].append("Path contains null bytes")
            result["is_safe"] = False
        
        # Platform-specific checks
        if PLATFORM.is_windows:
            # Check for Windows-specific issues
            if any(char in path_str for char in '<>"|?*'):
                result["warnings"].append("Path contains characters that may be problematic on Windows")
            
            # Check for reserved device names
            parts = path_obj.parts
            for part in parts:
                base_name = part.split('.')[0].upper()
                if base_name in {'CON', 'PRN', 'AUX', 'NUL'} or base_name.startswith(('COM', 'LPT')):
                    result["warnings"].append(f"Path contains reserved Windows device name: {part}")
        
        # Check path length
        if len(path_str) > 260 and PLATFORM.is_windows:
            result["warnings"].append("Path length exceeds Windows MAX_PATH limit (260 characters)")
        elif len(path_str) > 4096:
            result["warnings"].append("Path length is very long (>4096 characters)")
        
        # Check if path tries to escape expected boundaries
        try:
            resolved = path_obj.resolve()
            if not str(resolved).startswith(os.getcwd()):
                result["warnings"].append("Path resolves outside current working directory")
        except (OSError, ValueError):
            result["warnings"].append("Path cannot be resolved")
        
    except Exception as e:
        result["errors"].append(f"Path validation failed: {e}")
        result["is_safe"] = False
    
    return result


def get_platform_info() -> Dict[str, Any]:
    """
    Get comprehensive platform information.
    
    Returns:
        Dictionary with platform details
    """
    return PLATFORM.to_dict()


def format_path_for_display(path: Union[str, Path], max_length: int = 60) -> str:
    """
    Format a path for display, truncating if necessary.
    
    Args:
        path: Path to format
        max_length: Maximum length for display
        
    Returns:
        Formatted path string
    """
    path_str = str(path)
    
    if len(path_str) <= max_length:
        return path_str
    
    # Try to keep the filename and show truncated directory
    path_obj = Path(path_str)
    filename = path_obj.name
    
    if len(filename) >= max_length - 3:
        # Even filename is too long
        return filename[:max_length - 3] + "..."
    
    # Show truncated directory + filename
    available_length = max_length - len(filename) - 4  # 4 for ".../"
    if available_length > 0:
        parent_str = str(path_obj.parent)
        if len(parent_str) > available_length:
            parent_str = parent_str[:available_length]
        return f"{parent_str}.../{filename}"
    else:
        return f".../{filename}"