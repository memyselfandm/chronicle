#!/usr/bin/env python3
"""
Demo script for Chronicle hooks testing.
"""

def greet(name):
    """Simple greeting function."""
    return f"Hello, {name}! Chronicle is watching! 👀"

def calculate(a, b):
    """Simple calculation."""
    return a + b

if __name__ == "__main__":
    print(greet("Developer"))
    result = calculate(10, 5)
    print(f"10 + 5 = {result}")
