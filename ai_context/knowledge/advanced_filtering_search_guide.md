# Advanced Filtering & Search Guide for Large Datasets

## Overview
This guide covers implementation patterns for complex filtering and search systems in React applications handling large datasets. Based on research of performance optimization techniques, URL state management, and modern React patterns.

## Core Architecture Patterns

### 1. Performance-Optimized Filtering with useMemo

```typescript
// Optimized filtering for large datasets
const filteredEvents = useMemo(() => {
  if (!events?.length) return [];
  
  return events.filter(event => {
    // Apply multiple filter conditions
    const matchesSearch = !searchTerm || 
      event.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !selectedTypes.length || 
      selectedTypes.includes(event.type);
    const matchesDateRange = (!dateRange.start || event.timestamp >= dateRange.start) &&
      (!dateRange.end || event.timestamp <= dateRange.end);
    
    return matchesSearch && matchesType && matchesDateRange;
  });
}, [events, searchTerm, selectedTypes, dateRange]);
```

### 2. Debounced Search Implementation

```typescript
import { useMemo, useState, useEffect } from 'react';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Usage in search component
function SearchInput({ onSearch }: { onSearch: (term: string) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    onSearch(debouncedSearchTerm);
  }, [debouncedSearchTerm, onSearch]);

  return (
    <input
      type="text"
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Search events..."
    />
  );
}
```

### 3. Multi-Select Filter Component

```typescript
interface MultiSelectFilterProps {
  options: Array<{ value: string; label: string; count?: number }>;
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder?: string;
}

function MultiSelectFilter({ 
  options, 
  selectedValues, 
  onSelectionChange,
  placeholder = "Select options..."
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onSelectionChange(selectedValues.filter(v => v !== value));
    } else {
      onSelectionChange([...selectedValues, value]);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border rounded-md text-left"
      >
        {selectedValues.length === 0 
          ? placeholder 
          : `${selectedValues.length} selected`
        }
      </button>
      
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg">
          {options.map(option => (
            <label key={option.value} className="flex items-center px-3 py-2 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selectedValues.includes(option.value)}
                onChange={() => toggleOption(option.value)}
                className="mr-2"
              />
              <span className="flex-1">{option.label}</span>
              {option.count && (
                <span className="text-sm text-gray-500">({option.count})</span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
```

## URL State Management

### 1. URLSearchParams for Filter Persistence

```typescript
// Hook for managing filter state in URL
function useURLFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => ({
    search: searchParams.get('search') || '',
    types: searchParams.getAll('type'),
    sessionIds: searchParams.getAll('session'),
    dateStart: searchParams.get('start') || null,
    dateEnd: searchParams.get('end') || null,
  }), [searchParams]);

  const updateFilters = useCallback((newFilters: Partial<typeof filters>) => {
    const params = new URLSearchParams();

    // Add search term
    if (newFilters.search) {
      params.set('search', newFilters.search);
    }

    // Add multiple types
    newFilters.types?.forEach(type => {
      params.append('type', type);
    });

    // Add multiple session IDs
    newFilters.sessionIds?.forEach(sessionId => {
      params.append('session', sessionId);
    });

    // Add date range
    if (newFilters.dateStart) {
      params.set('start', newFilters.dateStart);
    }
    if (newFilters.dateEnd) {
      params.set('end', newFilters.dateEnd);
    }

    setSearchParams(params);
  }, [setSearchParams]);

  return { filters, updateFilters };
}
```

### 2. Saved Filter Presets

```typescript
// Filter preset management
interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: Date;
}

function useFilterPresets() {
  const [presets, setPresets] = useState<FilterPreset[]>(() => {
    const saved = localStorage.getItem('filter-presets');
    return saved ? JSON.parse(saved) : [];
  });

  const savePreset = (name: string, filters: FilterState) => {
    const preset: FilterPreset = {
      id: crypto.randomUUID(),
      name,
      filters,
      createdAt: new Date(),
    };
    
    const newPresets = [...presets, preset];
    setPresets(newPresets);
    localStorage.setItem('filter-presets', JSON.stringify(newPresets));
  };

  const loadPreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    return preset?.filters || null;
  };

  const deletePreset = (presetId: string) => {
    const newPresets = presets.filter(p => p.id !== presetId);
    setPresets(newPresets);
    localStorage.setItem('filter-presets', JSON.stringify(newPresets));
  };

  return { presets, savePreset, loadPreset, deletePreset };
}
```

## Large Dataset Performance Optimization

### 1. Task Yielding for Responsive UI

```typescript
// Yield to main thread during heavy processing
async function yieldToMain() {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}

async function processLargeDataset(items: any[], processor: (item: any) => any) {
  const results = [];
  let lastYield = performance.now();
  
  for (const item of items) {
    results.push(processor(item));
    
    // Yield every 50ms to keep UI responsive
    if (performance.now() - lastYield > 50) {
      await yieldToMain();
      lastYield = performance.now();
    }
  }
  
  return results;
}
```

### 2. Virtual Scrolling for Large Lists

```typescript
// Virtual scrolling component for performance
interface VirtualScrollProps {
  items: any[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: any, index: number) => React.ReactNode;
}

function VirtualScroll({ items, itemHeight, containerHeight, renderItem }: VirtualScrollProps) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount + 1, items.length);
  
  const visibleItems = items.slice(startIndex, endIndex);
  
  return (
    <div 
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        {visibleItems.map((item, index) => (
          <div
            key={startIndex + index}
            style={{
              position: 'absolute',
              top: (startIndex + index) * itemHeight,
              height: itemHeight,
              width: '100%',
            }}
          >
            {renderItem(item, startIndex + index)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 3. Component Re-render Optimization

```typescript
// Optimize expensive components by lifting to prevent re-renders
function FilteredEventList({ events, filters }: { events: Event[]; filters: FilterState }) {
  // Expensive filtering operation
  const filteredEvents = useMemo(() => {
    return processLargeDataset(events, (event) => applyFilters(event, filters));
  }, [events, filters]);

  // Lift static components to parent to prevent re-renders
  const eventListComponent = useMemo(() => (
    <ExpensiveEventList events={filteredEvents} />
  ), [filteredEvents]);

  return (
    <div>
      <FilterControls filters={filters} onFiltersChange={updateFilters} />
      {eventListComponent}
    </div>
  );
}
```

## Advanced Filter Logic

### 1. Complex AND/OR Filter Combinations

```typescript
interface FilterCondition {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'in';
  value: any;
}

interface FilterGroup {
  conditions: FilterCondition[];
  operator: 'AND' | 'OR';
}

function applyAdvancedFilters(items: any[], filterGroups: FilterGroup[]): any[] {
  return items.filter(item => {
    return filterGroups.every(group => {
      if (group.operator === 'AND') {
        return group.conditions.every(condition => evaluateCondition(item, condition));
      } else {
        return group.conditions.some(condition => evaluateCondition(item, condition));
      }
    });
  });
}

function evaluateCondition(item: any, condition: FilterCondition): boolean {
  const fieldValue = item[condition.field];
  
  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value;
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
    case 'gt':
      return fieldValue > condition.value;
    case 'lt':
      return fieldValue < condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    default:
      return true;
  }
}
```

### 2. Date Range Filtering with Presets

```typescript
interface DateRangePreset {
  label: string;
  getRange: () => { start: Date; end: Date };
}

const DATE_PRESETS: DateRangePreset[] = [
  {
    label: 'Last 24 hours',
    getRange: () => ({
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(),
    }),
  },
  {
    label: 'Last 7 days',
    getRange: () => ({
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date(),
    }),
  },
  {
    label: 'Last 30 days',
    getRange: () => ({
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date(),
    }),
  },
];

function DateRangeFilter({ onChange }: { onChange: (range: { start: Date; end: Date } | null) => void }) {
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {DATE_PRESETS.map(preset => (
          <button
            key={preset.label}
            onClick={() => onChange(preset.getRange())}
            className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
          >
            {preset.label}
          </button>
        ))}
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <input
          type="datetime-local"
          value={customRange.start}
          onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
          className="px-3 py-2 border rounded"
        />
        <input
          type="datetime-local"
          value={customRange.end}
          onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
          className="px-3 py-2 border rounded"
        />
      </div>
      
      <button
        onClick={() => {
          if (customRange.start && customRange.end) {
            onChange({
              start: new Date(customRange.start),
              end: new Date(customRange.end),
            });
          }
        }}
        className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Apply Custom Range
      </button>
    </div>
  );
}
```

## Performance Monitoring

### 1. Filter Performance Metrics

```typescript
// Monitor filter performance
function useFilterPerformance() {
  const [metrics, setMetrics] = useState<{
    filterTime: number;
    resultCount: number;
    lastUpdated: Date;
  }>({ filterTime: 0, resultCount: 0, lastUpdated: new Date() });

  const measureFilter = useCallback(async (filterFn: () => any[]) => {
    const startTime = performance.now();
    const results = await filterFn();
    const endTime = performance.now();
    
    setMetrics({
      filterTime: endTime - startTime,
      resultCount: results.length,
      lastUpdated: new Date(),
    });
    
    return results;
  }, []);

  return { metrics, measureFilter };
}
```

## Best Practices Summary

1. **Performance Optimization**:
   - Use `useMemo` for expensive filtering operations
   - Implement debouncing for search inputs (300ms recommended)
   - Yield to main thread during heavy processing (every 50ms)
   - Use virtual scrolling for large lists

2. **State Management**:
   - Persist filter state in URL using URLSearchParams
   - Implement saved filter presets with localStorage
   - Use proper dependency arrays for hooks

3. **User Experience**:
   - Provide visual feedback during filtering operations
   - Show result counts and performance metrics
   - Implement progressive disclosure for complex filters
   - Use keyboard shortcuts for power users

4. **Accessibility**:
   - Ensure keyboard navigation for all filter controls
   - Provide proper ARIA labels and descriptions
   - Announce filter results to screen readers

5. **Error Handling**:
   - Gracefully handle invalid filter states
   - Provide fallback options when filters fail
   - Log performance issues for monitoring