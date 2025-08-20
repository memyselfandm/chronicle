# SWR Data Fetching Patterns Reference for Chronicle MVP

## Overview
Comprehensive reference for implementing SWR data fetching strategies in the Chronicle observability dashboard, focusing on caching optimization, revalidation patterns, error handling, and offline support for real-time data scenarios.

## Core SWR Patterns

### 1. Basic SWR Implementation
```javascript
import useSWR from 'swr';

// Basic fetcher function
const fetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch');
  }
  return response.json();
};

// Simple hook usage
const useEvents = (filters) => {
  const { data, error, isLoading, mutate } = useSWR(
    filters ? `/api/events?${new URLSearchParams(filters)}` : null,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true
    }
  );

  return {
    events: data?.events || [],
    isLoading,
    isError: error,
    refresh: mutate
  };
};
```

### 2. Advanced Fetcher with Error Handling
```javascript
// Robust fetcher with retry logic and error classification
const createRobustFetcher = (baseURL, options = {}) => {
  const { retries = 3, retryDelay = 1000, timeout = 10000 } = options;

  return async (endpoint) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let lastError;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`${baseURL}${endpoint}`, {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Classify error types
          if (response.status >= 400 && response.status < 500) {
            // Client error - don't retry
            throw new Error(`Client error: ${response.status} ${response.statusText}`);
          } else if (response.status >= 500) {
            // Server error - retry
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
          }
        }

        return await response.json();
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors or abort errors
        if (error.name === 'AbortError' || error.message.includes('Client error')) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          await new Promise(resolve => 
            setTimeout(resolve, retryDelay * Math.pow(2, attempt))
          );
        }
      }
    }
    
    throw lastError;
  };
};

const fetcher = createRobustFetcher('/api', {
  retries: 3,
  retryDelay: 1000,
  timeout: 15000
});
```

## Caching Strategies

### 1. Advanced Cache Configuration
```javascript
import { SWRConfig } from 'swr';

// Global SWR configuration with custom cache
const ChronicleApp = ({ children }) => {
  return (
    <SWRConfig
      value={{
        // Custom cache provider with size limits
        provider: () => {
          const cache = new Map();
          const MAX_CACHE_SIZE = 1000;
          
          return {
            get: (key) => cache.get(key),
            set: (key, value) => {
              // Implement LRU eviction
              if (cache.size >= MAX_CACHE_SIZE) {
                const firstKey = cache.keys().next().value;
                cache.delete(firstKey);
              }
              cache.set(key, value);
            },
            delete: (key) => cache.delete(key),
            keys: () => Array.from(cache.keys())
          };
        },
        
        // Global configuration
        fetcher,
        refreshInterval: 0, // Disable by default, enable per hook
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        errorRetryCount: 3,
        errorRetryInterval: 5000,
        
        // Custom error handler
        onError: (error, key) => {
          console.error(`SWR Error for ${key}:`, error);
          // Report to error tracking service
          if (error.status !== 403 && error.status !== 404) {
            errorTracker.captureException(error);
          }
        },
        
        // Loading timeout
        loadingTimeout: 3000,
        
        // Global success handler
        onSuccess: (data, key) => {
          // Update last fetch timestamp
          localStorage.setItem(`swr_last_fetch_${key}`, Date.now().toString());
        }
      }}
    >
      {children}
    </SWRConfig>
  );
};
```

### 2. Smart Cache Key Generation
```javascript
// Dynamic cache key generation for complex queries
const createCacheKey = (endpoint, params = {}, dependencies = []) => {
  // Sort params for consistent cache keys
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});
  
  // Include dependencies in cache key
  const keyParts = [
    endpoint,
    JSON.stringify(sortedParams),
    dependencies.join('|')
  ].filter(Boolean);
  
  return keyParts.join('::');
};

// Usage in hooks
const useFilteredEvents = (filters, dependencies = []) => {
  const cacheKey = createCacheKey('/events', filters, dependencies);
  
  const { data, error, isLoading, mutate } = useSWR(
    cacheKey,
    () => fetcher(`/events?${new URLSearchParams(filters)}`),
    {
      // Cache for 5 minutes for filtered results
      dedupingInterval: 300000,
      // More aggressive revalidation for filtered data
      refreshInterval: 60000
    }
  );

  return { events: data, error, isLoading, refetch: mutate };
};
```

### 3. Cache Invalidation Strategies
```javascript
// Cache invalidation utilities
export const useCacheInvalidation = () => {
  const { mutate } = useSWRConfig();

  const invalidateEvents = useCallback(() => {
    // Invalidate all event-related cache entries
    mutate(
      key => typeof key === 'string' && key.includes('/events'),
      undefined,
      { revalidate: true }
    );
  }, [mutate]);

  const invalidateSessions = useCallback(() => {
    mutate(
      key => typeof key === 'string' && key.includes('/sessions'),
      undefined,
      { revalidate: true }
    );
  }, [mutate]);

  const invalidateSpecificEvent = useCallback((eventId) => {
    mutate(`/events/${eventId}`, undefined, { revalidate: true });
  }, [mutate]);

  const invalidateByPattern = useCallback((pattern) => {
    mutate(
      key => typeof key === 'string' && new RegExp(pattern).test(key),
      undefined,
      { revalidate: true }
    );
  }, [mutate]);

  return {
    invalidateEvents,
    invalidateSessions,
    invalidateSpecificEvent,
    invalidateByPattern
  };
};

// Real-time cache updates with optimistic UI
const useOptimisticEvents = () => {
  const { data: events, mutate } = useSWR('/events', fetcher);
  const { invalidateEvents } = useCacheInvalidation();

  const addEventOptimistically = useCallback(async (newEvent) => {
    // Optimistically update cache
    const optimisticEvents = [newEvent, ...(events || [])];
    mutate(optimisticEvents, false);

    try {
      // Persist to backend
      const createdEvent = await api.createEvent(newEvent);
      
      // Update cache with real data
      const updatedEvents = [createdEvent, ...(events || []).slice(1)];
      mutate(updatedEvents, false);
      
      return createdEvent;
    } catch (error) {
      // Rollback optimistic update
      mutate(events, false);
      throw error;
    }
  }, [events, mutate]);

  return { events, addEventOptimistically };
};
```

## Revalidation Patterns

### 1. Conditional Revalidation
```javascript
// Smart revalidation based on data freshness
const useSmartRevalidation = (key, fetcher, options = {}) => {
  const { maxAge = 300000, backgroundRefresh = true } = options; // 5 minutes default
  
  const shouldRevalidate = useCallback(() => {
    const lastFetch = localStorage.getItem(`swr_last_fetch_${key}`);
    if (!lastFetch) return true;
    
    const age = Date.now() - parseInt(lastFetch);
    return age > maxAge;
  }, [key, maxAge]);

  return useSWR(
    key,
    fetcher,
    {
      revalidateIfStale: shouldRevalidate(),
      revalidateOnFocus: shouldRevalidate(),
      revalidateOnReconnect: true,
      refreshInterval: backgroundRefresh ? maxAge : 0,
      dedupingInterval: Math.min(maxAge / 2, 60000) // Half of max age or 1 minute
    }
  );
};

// Usage for different data types
const useEvents = (filters) => useSmartRevalidation(
  `/events?${new URLSearchParams(filters)}`,
  fetcher,
  { maxAge: 120000, backgroundRefresh: true } // 2 minutes, with background refresh
);

const useSessionDetails = (sessionId) => useSmartRevalidation(
  `/sessions/${sessionId}`,
  fetcher,
  { maxAge: 600000, backgroundRefresh: false } // 10 minutes, no background refresh
);
```

### 2. User Activity-Based Revalidation
```javascript
// Revalidate based on user activity patterns
const useActivityBasedRevalidation = () => {
  const [isUserActive, setIsUserActive] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());
  
  useEffect(() => {
    let inactivityTimer;
    
    const resetTimer = () => {
      setLastActivity(Date.now());
      setIsUserActive(true);
      clearTimeout(inactivityTimer);
      
      // Mark as inactive after 5 minutes
      inactivityTimer = setTimeout(() => {
        setIsUserActive(false);
      }, 300000);
    };
    
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });
    
    resetTimer(); // Initialize timer
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimer, true);
      });
      clearTimeout(inactivityTimer);
    };
  }, []);
  
  return { isUserActive, lastActivity };
};

// Hook that adjusts refresh behavior based on activity
const useActivityAwareData = (key, fetcher) => {
  const { isUserActive } = useActivityBasedRevalidation();
  
  return useSWR(key, fetcher, {
    refreshInterval: isUserActive ? 30000 : 300000, // 30s active, 5m inactive
    revalidateOnFocus: isUserActive,
    dedupingInterval: isUserActive ? 10000 : 60000
  });
};
```

## Error Handling Strategies

### 1. Comprehensive Error Handling
```javascript
// Error boundary for SWR errors
class SWRErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('SWR Error Boundary:', error, errorInfo);
    errorTracker.captureException(error, { extra: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

// Error handling hook with retry logic
const useErrorHandling = () => {
  const [errorState, setErrorState] = useState({
    errors: new Map(),
    retryAttempts: new Map()
  });

  const handleError = useCallback((key, error) => {
    setErrorState(prev => {
      const newErrors = new Map(prev.errors);
      const newRetryAttempts = new Map(prev.retryAttempts);
      
      newErrors.set(key, error);
      newRetryAttempts.set(key, (prev.retryAttempts.get(key) || 0) + 1);
      
      return {
        errors: newErrors,
        retryAttempts: newRetryAttempts
      };
    });
  }, []);

  const clearError = useCallback((key) => {
    setErrorState(prev => {
      const newErrors = new Map(prev.errors);
      const newRetryAttempts = new Map(prev.retryAttempts);
      
      newErrors.delete(key);
      newRetryAttempts.delete(key);
      
      return {
        errors: newErrors,
        retryAttempts: newRetryAttempts
      };
    });
  }, []);

  const shouldRetry = useCallback((key, maxRetries = 3) => {
    const attempts = errorState.retryAttempts.get(key) || 0;
    return attempts < maxRetries;
  }, [errorState.retryAttempts]);

  return {
    errors: errorState.errors,
    retryAttempts: errorState.retryAttempts,
    handleError,
    clearError,
    shouldRetry
  };
};
```

### 2. Graceful Degradation
```javascript
// Hook with fallback data strategies
const useResilientData = (key, fetcher, fallbackData = null) => {
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    fallbackData,
    errorRetryCount: 3,
    errorRetryInterval: 5000,
    shouldRetryOnError: (error) => {
      // Don't retry on client errors
      return !error.status || error.status >= 500;
    }
  });

  // Provide stale data during errors
  const staleData = useMemo(() => {
    if (error && !data) {
      // Try to get cached data
      const cached = localStorage.getItem(`cache_${key}`);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          return fallbackData;
        }
      }
    }
    return data;
  }, [data, error, key, fallbackData]);

  // Cache successful responses
  useEffect(() => {
    if (data && !error) {
      localStorage.setItem(`cache_${key}`, JSON.stringify(data));
    }
  }, [data, error, key]);

  return {
    data: staleData,
    error,
    isLoading,
    mutate,
    isStale: !!error && !!staleData
  };
};
```

## Offline Support

### 1. Offline Detection and Queuing
```javascript
// Offline support with request queuing
const useOfflineSupport = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedRequests, setQueuedRequests] = useState([]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Process queued requests when back online
      processQueuedRequests();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const queueRequest = useCallback((request) => {
    setQueuedRequests(prev => [...prev, request]);
  }, []);

  const processQueuedRequests = useCallback(async () => {
    for (const request of queuedRequests) {
      try {
        await request.execute();
      } catch (error) {
        console.error('Failed to process queued request:', error);
      }
    }
    setQueuedRequests([]);
  }, [queuedRequests]);

  return { isOnline, queueRequest };
};

// Offline-aware SWR hook
const useOfflineAwareSWR = (key, fetcher, options = {}) => {
  const { isOnline, queueRequest } = useOfflineSupport();
  
  return useSWR(
    key,
    isOnline ? fetcher : null, // Don't fetch when offline
    {
      ...options,
      revalidateOnReconnect: true,
      errorRetryCount: isOnline ? 3 : 0,
      onError: (error) => {
        if (!isOnline) {
          // Queue for retry when online
          queueRequest({
            key,
            execute: () => fetcher(key)
          });
        }
      }
    }
  );
};
```

### 2. Persistent Cache for Offline
```javascript
// Persistent cache using IndexedDB
class PersistentCache {
  constructor(dbName = 'chronicle-cache', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp');
        }
      };
    });
  }

  async get(key) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (result && Date.now() - result.timestamp < 86400000) { // 24 hours
          resolve(result.data);
        } else {
          resolve(null);
        }
      };
    });
  }

  async set(key, data) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.put({
        key,
        data,
        timestamp: Date.now()
      });
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

// SWR integration with persistent cache
const persistentCache = new PersistentCache();

const usePersistentSWR = (key, fetcher, options = {}) => {
  const [persistentData, setPersistentData] = useState(null);
  
  // Load from persistent cache on mount
  useEffect(() => {
    persistentCache.get(key).then(data => {
      if (data) setPersistentData(data);
    });
  }, [key]);

  const { data, error, isLoading, mutate } = useSWR(
    key,
    fetcher,
    {
      ...options,
      fallbackData: persistentData,
      onSuccess: (data) => {
        // Save to persistent cache
        persistentCache.set(key, data);
        if (options.onSuccess) options.onSuccess(data);
      }
    }
  );

  return { data: data || persistentData, error, isLoading, mutate };
};
```

## Performance Optimization

### 1. Request Deduplication and Batching
```javascript
// Batch multiple requests into single API call
class RequestBatcher {
  constructor(batchSize = 10, batchDelay = 100) {
    this.batchSize = batchSize;
    this.batchDelay = batchDelay;
    this.queue = [];
    this.batchTimeout = null;
  }

  add(request) {
    return new Promise((resolve, reject) => {
      this.queue.push({ ...request, resolve, reject });
      
      if (this.queue.length >= this.batchSize) {
        this.processBatch();
      } else {
        this.scheduleBatch();
      }
    });
  }

  scheduleBatch() {
    if (this.batchTimeout) return;
    
    this.batchTimeout = setTimeout(() => {
      this.processBatch();
    }, this.batchDelay);
  }

  async processBatch() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.batchSize);
    
    try {
      // Batch API call
      const results = await api.batchRequest(
        batch.map(item => ({ endpoint: item.endpoint, params: item.params }))
      );
      
      // Resolve individual promises
      batch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      // Reject all promises in batch
      batch.forEach(item => item.reject(error));
    }
  }
}

const requestBatcher = new RequestBatcher();

// Batched SWR fetcher
const batchedFetcher = (endpoint, params) => {
  return requestBatcher.add({ endpoint, params });
};
```

### 2. Preloading and Prefetching
```javascript
// Preload hook for anticipated data needs
const usePreloader = () => {
  const { mutate } = useSWRConfig();

  const preload = useCallback(async (key, fetcher) => {
    // Check if already cached
    const cached = mutate(key);
    if (cached) return cached;

    // Preload in background
    try {
      const data = await fetcher(key);
      mutate(key, data, false); // Update cache without triggering revalidation
      return data;
    } catch (error) {
      console.warn('Preload failed:', key, error);
      return null;
    }
  }, [mutate]);

  const preloadEvents = useCallback((filters) => {
    const key = `/events?${new URLSearchParams(filters)}`;
    return preload(key, fetcher);
  }, [preload]);

  const preloadSessionDetails = useCallback((sessionId) => {
    const key = `/sessions/${sessionId}`;
    return preload(key, fetcher);
  }, [preload]);

  return { preload, preloadEvents, preloadSessionDetails };
};

// Intersection Observer for lazy loading
const useLazyLoad = (ref, onIntersect) => {
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onIntersect();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [ref, onIntersect]);
};
```

This comprehensive SWR reference provides patterns and strategies specifically designed for the Chronicle MVP dashboard, focusing on high-performance data fetching, intelligent caching, robust error handling, and offline capabilities for a seamless user experience.