import { renderHook, act } from '@testing-library/react';
import { useRef, RefObject } from 'react';
import { useResizeObserver } from '../../src/hooks/useResizeObserver';

// Mock ResizeObserver
class MockResizeObserver {
  private callback: ResizeObserverCallback;
  private elements = new Set<Element>();
  
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(element: Element) {
    this.elements.add(element);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
  }

  // Simulate a resize event
  triggerResize(entries: ResizeObserverEntry[]) {
    this.callback(entries, this);
  }
}

// Store reference to mock instances for testing
let mockObserverInstances: MockResizeObserver[] = [];

// Mock the global ResizeObserver
const originalResizeObserver = global.ResizeObserver;

beforeAll(() => {
  global.ResizeObserver = jest.fn((callback) => {
    const instance = new MockResizeObserver(callback);
    mockObserverInstances.push(instance);
    return instance;
  }) as any;
});

afterAll(() => {
  global.ResizeObserver = originalResizeObserver;
});

beforeEach(() => {
  mockObserverInstances = [];
  jest.clearAllMocks();
});

describe('useResizeObserver Hook', () => {
  // Helper to create mock ResizeObserverEntry
  const createMockEntry = (width: number, height: number): ResizeObserverEntry => ({
    target: document.createElement('div'),
    contentRect: {
      width,
      height,
      top: 0,
      left: 0,
      bottom: height,
      right: width,
      x: 0,
      y: 0,
    },
    borderBoxSize: [{
      inlineSize: width,
      blockSize: height,
    }],
    contentBoxSize: [{
      inlineSize: width,
      blockSize: height,
    }],
    devicePixelContentBoxSize: [{
      inlineSize: width,
      blockSize: height,
    }],
  } as ResizeObserverEntry);

  it('should create ResizeObserver when element is present', () => {
    const mockCallback = jest.fn();
    const mockElement = document.createElement('div');

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(mockElement);
      useResizeObserver(ref, mockCallback);
      return ref;
    });

    expect(global.ResizeObserver).toHaveBeenCalledWith(expect.any(Function));
    expect(mockObserverInstances).toHaveLength(1);
    expect(mockObserverInstances[0].elements.has(mockElement)).toBe(true);
  });

  it('should not create ResizeObserver when element is null', () => {
    const mockCallback = jest.fn();

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      useResizeObserver(ref, mockCallback);
      return ref;
    });

    expect(global.ResizeObserver).not.toHaveBeenCalled();
    expect(mockObserverInstances).toHaveLength(0);
  });

  it('should call callback when resize event occurs', () => {
    const mockCallback = jest.fn();
    const mockElement = document.createElement('div');

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(mockElement);
      useResizeObserver(ref, mockCallback);
      return ref;
    });

    // Simulate a resize event
    const mockEntry = createMockEntry(400, 300);
    
    act(() => {
      mockObserverInstances[0].triggerResize([mockEntry]);
    });

    expect(mockCallback).toHaveBeenCalledWith(mockEntry);
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple resize entries', () => {
    const mockCallback = jest.fn();
    const mockElement = document.createElement('div');

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(mockElement);
      useResizeObserver(ref, mockCallback);
      return ref;
    });

    // Simulate multiple resize entries
    const entries = [
      createMockEntry(400, 300),
      createMockEntry(500, 400),
      createMockEntry(600, 500),
    ];
    
    act(() => {
      mockObserverInstances[0].triggerResize(entries);
    });

    expect(mockCallback).toHaveBeenCalledTimes(3);
    entries.forEach((entry, index) => {
      expect(mockCallback).toHaveBeenNthCalledWith(index + 1, entry);
    });
  });

  it('should update callback reference without recreating observer', () => {
    const mockElement = document.createElement('div');
    let callbackCallCount = 0;

    const { rerender } = renderHook(
      ({ callback }) => {
        const ref = useRef<HTMLDivElement>(mockElement);
        useResizeObserver(ref, callback);
        return ref;
      },
      { 
        initialProps: { 
          callback: () => { callbackCallCount += 1; }
        } 
      }
    );

    expect(mockObserverInstances).toHaveLength(1);

    // Update the callback
    const newCallback = jest.fn();
    rerender({ callback: newCallback });

    // Should still have only one observer instance
    expect(mockObserverInstances).toHaveLength(1);

    // Trigger resize with new callback
    const mockEntry = createMockEntry(400, 300);
    
    act(() => {
      mockObserverInstances[0].triggerResize([mockEntry]);
    });

    expect(newCallback).toHaveBeenCalledWith(mockEntry);
    expect(callbackCallCount).toBe(0); // Old callback should not be called
  });

  it('should disconnect observer on unmount', () => {
    const mockCallback = jest.fn();
    const mockElement = document.createElement('div');
    const disconnectSpy = jest.spyOn(MockResizeObserver.prototype, 'disconnect');

    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(mockElement);
      useResizeObserver(ref, mockCallback);
      return ref;
    });

    expect(mockObserverInstances).toHaveLength(1);

    unmount();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
    disconnectSpy.mockRestore();
  });

  it('should handle element reference changes', () => {
    const mockCallback = jest.fn();
    const element1 = document.createElement('div');
    const element2 = document.createElement('div');

    const { rerender } = renderHook(
      ({ element }) => {
        const ref = useRef<HTMLDivElement>(element);
        useResizeObserver(ref, mockCallback);
        return ref;
      },
      { initialProps: { element: element1 } }
    );

    expect(mockObserverInstances).toHaveLength(1);
    expect(mockObserverInstances[0].elements.has(element1)).toBe(true);

    // Change element reference
    rerender({ element: element2 });

    // Should create new observer for new element
    expect(mockObserverInstances).toHaveLength(2);
    expect(mockObserverInstances[1].elements.has(element2)).toBe(true);
  });

  it('should handle element becoming null', () => {
    const mockCallback = jest.fn();
    const element = document.createElement('div');
    const disconnectSpy = jest.spyOn(MockResizeObserver.prototype, 'disconnect');

    const { rerender } = renderHook(
      ({ element }) => {
        const ref = useRef<HTMLDivElement>(element);
        useResizeObserver(ref, mockCallback);
        return ref;
      },
      { initialProps: { element } }
    );

    expect(mockObserverInstances).toHaveLength(1);

    // Set element to null
    rerender({ element: null });

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
    disconnectSpy.mockRestore();
  });

  it('should work with different element types', () => {
    const mockCallback = jest.fn();
    const elements = [
      document.createElement('div'),
      document.createElement('canvas'),
      document.createElement('img'),
      document.createElement('svg'),
    ];

    elements.forEach((element, index) => {
      renderHook(() => {
        const ref = useRef(element);
        useResizeObserver(ref, mockCallback);
        return ref;
      });

      expect(mockObserverInstances[index].elements.has(element)).toBe(true);
    });

    expect(mockObserverInstances).toHaveLength(4);
  });

  describe('Callback Behavior', () => {
    it('should preserve callback context', () => {
      const mockElement = document.createElement('div');
      let capturedThis: any = null;

      const contextualCallback = function(this: any, entry: ResizeObserverEntry) {
        capturedThis = this;
      };

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(mockElement);
        useResizeObserver(ref, contextualCallback);
        return ref;
      });

      const mockEntry = createMockEntry(400, 300);
      
      act(() => {
        mockObserverInstances[0].triggerResize([mockEntry]);
      });

      // Should preserve the original context
      expect(capturedThis).toBe(undefined); // Arrow functions and strict mode
    });

    it('should handle callback errors gracefully', () => {
      const mockElement = document.createElement('div');
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });

      // Spy on console.error to verify error handling
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(mockElement);
        useResizeObserver(ref, errorCallback);
        return ref;
      });

      const mockEntry = createMockEntry(400, 300);

      expect(() => {
        act(() => {
          mockObserverInstances[0].triggerResize([mockEntry]);
        });
      }).not.toThrow();

      expect(errorCallback).toHaveBeenCalledWith(mockEntry);
      consoleSpy.mockRestore();
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid successive resize events', () => {
      const mockCallback = jest.fn();
      const mockElement = document.createElement('div');

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(mockElement);
        useResizeObserver(ref, mockCallback);
        return ref;
      });

      // Simulate rapid resize events
      const entries = Array.from({ length: 100 }, (_, i) => 
        createMockEntry(400 + i, 300 + i)
      );

      act(() => {
        entries.forEach(entry => {
          mockObserverInstances[0].triggerResize([entry]);
        });
      });

      expect(mockCallback).toHaveBeenCalledTimes(100);
    });

    it('should work with zero dimensions', () => {
      const mockCallback = jest.fn();
      const mockElement = document.createElement('div');

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(mockElement);
        useResizeObserver(ref, mockCallback);
        return ref;
      });

      const zeroEntry = createMockEntry(0, 0);
      
      act(() => {
        mockObserverInstances[0].triggerResize([zeroEntry]);
      });

      expect(mockCallback).toHaveBeenCalledWith(zeroEntry);
    });

    it('should work with very large dimensions', () => {
      const mockCallback = jest.fn();
      const mockElement = document.createElement('div');

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(mockElement);
        useResizeObserver(ref, mockCallback);
        return ref;
      });

      const largeEntry = createMockEntry(999999, 999999);
      
      act(() => {
        mockObserverInstances[0].triggerResize([largeEntry]);
      });

      expect(mockCallback).toHaveBeenCalledWith(largeEntry);
    });
  });

  describe('Memory Leaks Prevention', () => {
    it('should not hold references after unmount', () => {
      const mockCallback = jest.fn();
      const mockElement = document.createElement('div');
      
      const { unmount } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(mockElement);
        useResizeObserver(ref, mockCallback);
        return ref;
      });

      expect(mockObserverInstances).toHaveLength(1);
      expect(mockObserverInstances[0].elements.size).toBe(1);

      unmount();

      expect(mockObserverInstances[0].elements.size).toBe(0);
    });

    it('should handle multiple mount/unmount cycles', () => {
      const mockCallback = jest.fn();
      const mockElement = document.createElement('div');
      const disconnectSpy = jest.spyOn(MockResizeObserver.prototype, 'disconnect');

      // Mount and unmount multiple times
      for (let i = 0; i < 5; i++) {
        const { unmount } = renderHook(() => {
          const ref = useRef<HTMLDivElement>(mockElement);
          useResizeObserver(ref, mockCallback);
          return ref;
        });

        unmount();
      }

      expect(disconnectSpy).toHaveBeenCalledTimes(5);
      expect(mockObserverInstances).toHaveLength(5);
      
      disconnectSpy.mockRestore();
    });
  });
});