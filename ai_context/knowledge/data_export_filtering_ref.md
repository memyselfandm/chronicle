# Data Export and Filtering Reference Guide

## Overview
This guide provides comprehensive patterns for implementing data export functionality and advanced filtering systems in observability dashboards, with specific focus on CSV/JSON export formats, filter application, and efficient handling of large datasets.

## Data Export Architecture

### Export Format Support
Support multiple export formats for different use cases and downstream tools.

```javascript
const EXPORT_FORMATS = {
  CSV: 'csv',
  JSON: 'json',
  JSONL: 'jsonl', // JSON Lines for streaming
  EXCEL: 'xlsx',
  PARQUET: 'parquet' // For analytics tools
};

const EXPORT_MIME_TYPES = {
  [EXPORT_FORMATS.CSV]: 'text/csv',
  [EXPORT_FORMATS.JSON]: 'application/json',
  [EXPORT_FORMATS.JSONL]: 'application/x-jsonlines',
  [EXPORT_FORMATS.EXCEL]: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  [EXPORT_FORMATS.PARQUET]: 'application/octet-stream'
};
```

### Export Service Implementation
Core service for handling data export with filtering and formatting.

```javascript
class DataExportService {
  constructor(database, filterService) {
    this.database = database;
    this.filterService = filterService;
    this.maxExportRecords = 100000; // Safety limit
  }
  
  async exportData(params) {
    const {
      format,
      filters,
      columns,
      dateRange,
      maxRecords = this.maxExportRecords,
      includeMetadata = true
    } = params;
    
    // Apply filters and get data
    const query = this.filterService.buildQuery(filters, dateRange);
    const data = await this.database.query(query, { limit: maxRecords });
    
    // Format data based on export format
    const formattedData = await this.formatData(data, format, columns);
    
    // Generate metadata
    const metadata = includeMetadata ? this.generateMetadata(params, data.length) : null;
    
    return {
      data: formattedData,
      metadata,
      filename: this.generateFilename(format, filters, dateRange),
      mimeType: EXPORT_MIME_TYPES[format]
    };
  }
  
  async formatData(data, format, selectedColumns) {
    const columns = selectedColumns || this.getDefaultColumns();
    const processedData = data.map(row => this.processRow(row, columns));
    
    switch (format) {
      case EXPORT_FORMATS.CSV:
        return this.formatAsCSV(processedData, columns);
      case EXPORT_FORMATS.JSON:
        return this.formatAsJSON(processedData);
      case EXPORT_FORMATS.JSONL:
        return this.formatAsJSONL(processedData);
      case EXPORT_FORMATS.EXCEL:
        return this.formatAsExcel(processedData, columns);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
  
  formatAsCSV(data, columns) {
    const header = columns.map(col => this.escapeCSVField(col.displayName)).join(',');
    const rows = data.map(row => 
      columns.map(col => this.escapeCSVField(row[col.key] || '')).join(',')
    );
    
    return [header, ...rows].join('\n');
  }
  
  formatAsJSON(data) {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      count: data.length,
      data: data
    }, null, 2);
  }
  
  formatAsJSONL(data) {
    return data.map(row => JSON.stringify(row)).join('\n');
  }
  
  escapeCSVField(field) {
    const stringField = String(field);
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
  }
  
  generateFilename(format, filters, dateRange) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filterSummary = this.summarizeFilters(filters);
    const extension = format.toLowerCase();
    
    return `chronicle-export-${filterSummary}-${timestamp}.${extension}`;
  }
}
```

### React Hook for Data Export
Convenient React hook for export functionality.

```javascript
const useDataExport = () => {
  const [exportState, setExportState] = useState({
    isExporting: false,
    progress: 0,
    error: null
  });
  
  const exportService = useMemo(() => new DataExportService(), []);
  
  const exportData = useCallback(async (params) => {
    setExportState({ isExporting: true, progress: 0, error: null });
    
    try {
      // For large exports, show progress
      if (params.estimatedRows > 10000) {
        const result = await exportService.exportDataWithProgress(
          params,
          (progress) => setExportState(prev => ({ ...prev, progress }))
        );
        
        downloadFile(result.data, result.filename, result.mimeType);
      } else {
        const result = await exportService.exportData(params);
        downloadFile(result.data, result.filename, result.mimeType);
      }
      
      setExportState({ isExporting: false, progress: 100, error: null });
    } catch (error) {
      setExportState({ isExporting: false, progress: 0, error: error.message });
    }
  }, [exportService]);
  
  return { exportData, exportState };
};

const downloadFile = (data, filename, mimeType) => {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.download = filename;
  link.click();
  
  URL.revokeObjectURL(url);
};
```

## Advanced Filtering System

### Filter Types and Configuration
Comprehensive filter types for observability data.

```javascript
const FILTER_TYPES = {
  TEXT: 'text',
  SELECT: 'select',
  MULTISELECT: 'multiselect',
  DATE_RANGE: 'dateRange',
  NUMBER_RANGE: 'numberRange',
  BOOLEAN: 'boolean',
  TAGS: 'tags',
  REGEX: 'regex'
};

const FILTER_OPERATORS = {
  EQUALS: 'eq',
  NOT_EQUALS: 'ne',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'not_contains',
  STARTS_WITH: 'starts_with',
  ENDS_WITH: 'ends_with',
  GREATER_THAN: 'gt',
  LESS_THAN: 'lt',
  GREATER_EQUAL: 'gte',
  LESS_EQUAL: 'lte',
  IN: 'in',
  NOT_IN: 'not_in',
  BETWEEN: 'between',
  REGEX: 'regex'
};

const FILTER_DEFINITIONS = {
  sessionId: {
    type: FILTER_TYPES.TEXT,
    operators: [FILTER_OPERATORS.EQUALS, FILTER_OPERATORS.CONTAINS],
    placeholder: 'Enter session ID...',
    validation: (value) => value.length >= 3
  },
  toolType: {
    type: FILTER_TYPES.MULTISELECT,
    options: ['Read', 'Edit', 'Bash', 'Grep', 'Write', 'WebSearch'],
    operators: [FILTER_OPERATORS.IN, FILTER_OPERATORS.NOT_IN]
  },
  executionTime: {
    type: FILTER_TYPES.NUMBER_RANGE,
    operators: [FILTER_OPERATORS.BETWEEN, FILTER_OPERATORS.GREATER_THAN, FILTER_OPERATORS.LESS_THAN],
    unit: 'ms',
    min: 0,
    max: 60000
  },
  timestamp: {
    type: FILTER_TYPES.DATE_RANGE,
    operators: [FILTER_OPERATORS.BETWEEN],
    presets: ['last24h', 'last7d', 'last30d', 'custom']
  },
  hasError: {
    type: FILTER_TYPES.BOOLEAN,
    operators: [FILTER_OPERATORS.EQUALS]
  },
  sourceApp: {
    type: FILTER_TYPES.SELECT,
    options: ['Claude Code', 'Claude Pro', 'Claude API'],
    operators: [FILTER_OPERATORS.EQUALS, FILTER_OPERATORS.NOT_EQUALS]
  }
};
```

### Filter State Management
Zustand store for managing complex filter state.

```javascript
const useFilterStore = create((set, get) => ({
  filters: [],
  activeFilters: {},
  filterCombination: 'AND', // AND | OR
  savedFilters: {},
  
  addFilter: (filter) => set((state) => ({
    filters: [...state.filters, { ...filter, id: generateId() }]
  })),
  
  updateFilter: (filterId, updates) => set((state) => ({
    filters: state.filters.map(filter => 
      filter.id === filterId ? { ...filter, ...updates } : filter
    )
  })),
  
  removeFilter: (filterId) => set((state) => ({
    filters: state.filters.filter(filter => filter.id !== filterId)
  })),
  
  clearFilters: () => set({ filters: [], activeFilters: {} }),
  
  applyFilters: () => {
    const { filters } = get();
    const activeFilters = filters.reduce((acc, filter) => {
      if (filter.value !== undefined && filter.value !== null && filter.value !== '') {
        acc[filter.field] = filter;
      }
      return acc;
    }, {});
    
    set({ activeFilters });
    return activeFilters;
  },
  
  saveFilterPreset: (name, description) => {
    const { filters, filterCombination } = get();
    const preset = {
      name,
      description,
      filters: JSON.parse(JSON.stringify(filters)),
      filterCombination,
      createdAt: new Date().toISOString()
    };
    
    set((state) => ({
      savedFilters: { ...state.savedFilters, [name]: preset }
    }));
  },
  
  loadFilterPreset: (name) => {
    const { savedFilters } = get();
    const preset = savedFilters[name];
    
    if (preset) {
      set({
        filters: JSON.parse(JSON.stringify(preset.filters)),
        filterCombination: preset.filterCombination
      });
    }
  }
}));
```

### Filter Builder Component
Advanced filter builder interface.

```jsx
const FilterBuilder = ({ onFiltersChange }) => {
  const {
    filters,
    filterCombination,
    addFilter,
    updateFilter,
    removeFilter,
    applyFilters,
    saveFilterPreset,
    loadFilterPreset
  } = useFilterStore();
  
  const [showPresetModal, setShowPresetModal] = useState(false);
  
  useEffect(() => {
    const activeFilters = applyFilters();
    onFiltersChange(activeFilters, filterCombination);
  }, [filters, filterCombination]);
  
  return (
    <div className="filter-builder bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white">Filters</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPresetModal(true)}
            className="px-3 py-1 bg-gray-700 text-white rounded text-sm"
          >
            Presets
          </button>
          <button
            onClick={() => addFilter({ field: '', operator: '', value: '' })}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
          >
            Add Filter
          </button>
        </div>
      </div>
      
      {filters.length > 1 && (
        <div className="mb-4">
          <label className="text-sm text-gray-400">Combination:</label>
          <select
            value={filterCombination}
            onChange={(e) => useFilterStore.setState({ filterCombination: e.target.value })}
            className="ml-2 bg-gray-700 text-white rounded px-2 py-1"
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
        </div>
      )}
      
      <div className="space-y-3">
        {filters.map((filter, index) => (
          <FilterRow
            key={filter.id}
            filter={filter}
            index={index}
            onUpdate={(updates) => updateFilter(filter.id, updates)}
            onRemove={() => removeFilter(filter.id)}
          />
        ))}
      </div>
      
      {filters.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No filters applied. Click "Add Filter" to get started.
        </div>
      )}
      
      {showPresetModal && (
        <FilterPresetModal
          onClose={() => setShowPresetModal(false)}
          onSave={saveFilterPreset}
          onLoad={loadFilterPreset}
        />
      )}
    </div>
  );
};

const FilterRow = ({ filter, index, onUpdate, onRemove }) => {
  const filterDef = FILTER_DEFINITIONS[filter.field];
  
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-700 rounded">
      {index > 0 && (
        <span className="text-sm text-gray-400 uppercase">
          {useFilterStore.getState().filterCombination}
        </span>
      )}
      
      <select
        value={filter.field}
        onChange={(e) => onUpdate({ field: e.target.value, operator: '', value: '' })}
        className="bg-gray-600 text-white rounded px-3 py-2 min-w-32"
      >
        <option value="">Select Field</option>
        {Object.keys(FILTER_DEFINITIONS).map(field => (
          <option key={field} value={field}>
            {field.charAt(0).toUpperCase() + field.slice(1)}
          </option>
        ))}
      </select>
      
      {filter.field && filterDef && (
        <>
          <select
            value={filter.operator}
            onChange={(e) => onUpdate({ operator: e.target.value })}
            className="bg-gray-600 text-white rounded px-3 py-2"
          >
            <option value="">Select Operator</option>
            {filterDef.operators.map(op => (
              <option key={op} value={op}>
                {getOperatorLabel(op)}
              </option>
            ))}
          </select>
          
          <FilterValueInput
            filterDef={filterDef}
            value={filter.value}
            onChange={(value) => onUpdate({ value })}
          />
        </>
      )}
      
      <button
        onClick={onRemove}
        className="text-red-400 hover:text-red-300 p-1"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
};
```

## Large Dataset Handling

### Streaming Export for Large Datasets
Handle large data exports efficiently with streaming.

```javascript
class StreamingExportService extends DataExportService {
  async exportDataWithProgress(params, onProgress) {
    const {
      format,
      filters,
      columns,
      dateRange,
      chunkSize = 10000
    } = params;
    
    const query = this.filterService.buildQuery(filters, dateRange);
    const totalCount = await this.database.count(query);
    
    if (totalCount > this.maxExportRecords) {
      throw new Error(`Dataset too large: ${totalCount} records (max: ${this.maxExportRecords})`);
    }
    
    let processedCount = 0;
    let result = '';
    
    // Handle CSV header
    if (format === EXPORT_FORMATS.CSV) {
      const cols = columns || this.getDefaultColumns();
      result += cols.map(col => this.escapeCSVField(col.displayName)).join(',') + '\n';
    }
    
    // Process data in chunks
    for (let offset = 0; offset < totalCount; offset += chunkSize) {
      const chunk = await this.database.query(query, { 
        limit: chunkSize, 
        offset 
      });
      
      const formattedChunk = await this.formatChunk(chunk, format, columns);
      result += formattedChunk;
      
      processedCount += chunk.length;
      onProgress(Math.round((processedCount / totalCount) * 100));
      
      // Allow UI to update
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    return {
      data: result,
      metadata: this.generateMetadata(params, totalCount),
      filename: this.generateFilename(format, filters, dateRange),
      mimeType: EXPORT_MIME_TYPES[format]
    };
  }
  
  formatChunk(data, format, columns) {
    const cols = columns || this.getDefaultColumns();
    const processedData = data.map(row => this.processRow(row, cols));
    
    switch (format) {
      case EXPORT_FORMATS.CSV:
        return processedData.map(row => 
          cols.map(col => this.escapeCSVField(row[col.key] || '')).join(',')
        ).join('\n') + '\n';
      
      case EXPORT_FORMATS.JSONL:
        return processedData.map(row => JSON.stringify(row)).join('\n') + '\n';
      
      default:
        throw new Error(`Streaming not supported for format: ${format}`);
    }
  }
}
```

### Data Sampling for Preview
Implement intelligent data sampling for large dataset previews.

```javascript
class DataSamplingService {
  constructor(database) {
    this.database = database;
  }
  
  async generateSample(query, sampleSize = 1000, strategy = 'random') {
    const totalCount = await this.database.count(query);
    
    if (totalCount <= sampleSize) {
      return await this.database.query(query);
    }
    
    switch (strategy) {
      case 'random':
        return this.randomSample(query, sampleSize, totalCount);
      case 'systematic':
        return this.systematicSample(query, sampleSize, totalCount);
      case 'stratified':
        return this.stratifiedSample(query, sampleSize);
      default:
        return this.randomSample(query, sampleSize, totalCount);
    }
  }
  
  async randomSample(query, sampleSize, totalCount) {
    // Generate random offsets
    const offsets = new Set();
    while (offsets.size < sampleSize) {
      offsets.add(Math.floor(Math.random() * totalCount));
    }
    
    // Fetch records at random positions
    const samples = [];
    for (const offset of offsets) {
      const record = await this.database.query(query, { limit: 1, offset });
      if (record.length > 0) {
        samples.push(record[0]);
      }
    }
    
    return samples;
  }
  
  async systematicSample(query, sampleSize, totalCount) {
    const interval = Math.floor(totalCount / sampleSize);
    const samples = [];
    
    for (let i = 0; i < sampleSize; i++) {
      const offset = i * interval;
      const record = await this.database.query(query, { limit: 1, offset });
      if (record.length > 0) {
        samples.push(record[0]);
      }
    }
    
    return samples;
  }
  
  async stratifiedSample(query, sampleSize) {
    // Sample evenly across time periods or tool types
    const strata = await this.getDataStrata(query);
    const samplesPerStratum = Math.floor(sampleSize / strata.length);
    
    const samples = [];
    for (const stratum of strata) {
      const stratumQuery = { ...query, ...stratum.filter };
      const stratumSamples = await this.randomSample(
        stratumQuery, 
        samplesPerStratum, 
        stratum.count
      );
      samples.push(...stratumSamples);
    }
    
    return samples;
  }
}
```

## Export Column Configuration

### Column Selection Interface
Allow users to customize export columns.

```jsx
const ColumnSelector = ({ availableColumns, selectedColumns, onChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [columnGroups, setColumnGroups] = useState({});
  
  const filteredColumns = useMemo(() => {
    return availableColumns.filter(col => 
      col.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      col.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableColumns, searchTerm]);
  
  const toggleColumn = (columnKey) => {
    const newSelected = selectedColumns.includes(columnKey)
      ? selectedColumns.filter(key => key !== columnKey)
      : [...selectedColumns, columnKey];
    
    onChange(newSelected);
  };
  
  const toggleGroup = (groupName) => {
    const groupColumns = availableColumns
      .filter(col => col.group === groupName)
      .map(col => col.key);
    
    const allSelected = groupColumns.every(key => selectedColumns.includes(key));
    
    if (allSelected) {
      onChange(selectedColumns.filter(key => !groupColumns.includes(key)));
    } else {
      onChange([...new Set([...selectedColumns, ...groupColumns])]);
    }
  };
  
  return (
    <div className="column-selector">
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search columns..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
        />
      </div>
      
      <div className="space-y-4">
        {Object.entries(groupBy(filteredColumns, 'group')).map(([group, columns]) => (
          <div key={group} className="column-group">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={columns.every(col => selectedColumns.includes(col.key))}
                onChange={() => toggleGroup(group)}
                className="rounded"
              />
              <label className="font-medium text-white">{group}</label>
            </div>
            
            <div className="ml-6 space-y-1">
              {columns.map(column => (
                <div key={column.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(column.key)}
                    onChange={() => toggleColumn(column.key)}
                    className="rounded"
                  />
                  <label className="text-gray-300">{column.displayName}</label>
                  {column.description && (
                    <span className="text-xs text-gray-500">
                      {column.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Export Preview Component
Show preview of export data before download.

```jsx
const ExportPreview = ({ 
  data, 
  filters, 
  selectedColumns, 
  format,
  onExport,
  onCancel 
}) => {
  const [sampleData, setSampleData] = useState([]);
  const [estimatedSize, setEstimatedSize] = useState(0);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadPreview = async () => {
      setLoading(true);
      
      const samplingService = new DataSamplingService();
      const query = buildQuery(filters);
      const sample = await samplingService.generateSample(query, 100);
      
      setSampleData(sample);
      setEstimatedSize(await estimateExportSize(query, format, selectedColumns));
      setLoading(false);
    };
    
    loadPreview();
  }, [filters, selectedColumns, format]);
  
  if (loading) {
    return <div className="text-center py-8">Loading preview...</div>;
  }
  
  return (
    <div className="export-preview">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Export Preview</h3>
          <p className="text-sm text-gray-400">
            Showing {sampleData.length} sample records
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">Estimated size:</div>
          <div className="font-medium">{formatFileSize(estimatedSize)}</div>
        </div>
      </div>
      
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-700">
                {selectedColumns.map(colKey => {
                  const column = AVAILABLE_COLUMNS.find(c => c.key === colKey);
                  return (
                    <th key={colKey} className="px-3 py-2 text-left">
                      {column?.displayName || colKey}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sampleData.slice(0, 10).map((row, index) => (
                <tr key={index} className="border-t border-gray-700">
                  {selectedColumns.map(colKey => (
                    <td key={colKey} className="px-3 py-2">
                      <CellRenderer value={row[colKey]} column={colKey} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {sampleData.length > 10 && (
        <div className="mt-2 text-sm text-gray-400 text-center">
          ... and {sampleData.length - 10} more sample records
        </div>
      )}
      
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={onExport}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Export {format.toUpperCase()}
        </button>
      </div>
    </div>
  );
};
```

## Filter Persistence and URL State

### URL State Management
Persist filter state in URL for shareability.

```javascript
const useFilterURLState = () => {
  const [filters, setFilters] = useState([]);
  const router = useRouter();
  
  // Encode filters to URL params
  const encodeFiltersToURL = useCallback((filters, combination) => {
    const params = new URLSearchParams();
    
    const filterString = btoa(JSON.stringify({
      filters,
      combination
    }));
    
    params.set('f', filterString);
    
    router.push(`${router.pathname}?${params.toString()}`, undefined, { 
      shallow: true 
    });
  }, [router]);
  
  // Decode filters from URL params
  const decodeFiltersFromURL = useCallback(() => {
    const { f } = router.query;
    
    if (f) {
      try {
        const decoded = JSON.parse(atob(f));
        return decoded;
      } catch (error) {
        console.warn('Failed to decode filters from URL:', error);
      }
    }
    
    return { filters: [], combination: 'AND' };
  }, [router.query]);
  
  // Load filters from URL on mount
  useEffect(() => {
    const { filters, combination } = decodeFiltersFromURL();
    setFilters(filters);
    useFilterStore.setState({ filters, filterCombination: combination });
  }, []);
  
  return { encodeFiltersToURL, decodeFiltersFromURL };
};
```

### Saved Filter Presets
Manage saved filter configurations.

```javascript
const useFilterPresets = () => {
  const [presets, setPresets] = useState({});
  
  const savePreset = useCallback(async (name, description, filters, combination) => {
    const preset = {
      id: generateId(),
      name,
      description,
      filters,
      combination,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      useCount: 0
    };
    
    // Save to local storage
    const saved = JSON.parse(localStorage.getItem('filter_presets') || '{}');
    saved[preset.id] = preset;
    localStorage.setItem('filter_presets', JSON.stringify(saved));
    
    // Save to database for sync across devices
    await api.saveFilterPreset(preset);
    
    setPresets(prev => ({ ...prev, [preset.id]: preset }));
    
    return preset.id;
  }, []);
  
  const loadPreset = useCallback(async (presetId) => {
    const preset = presets[presetId];
    
    if (preset) {
      // Update usage statistics
      const updatedPreset = {
        ...preset,
        lastUsed: new Date().toISOString(),
        useCount: preset.useCount + 1
      };
      
      const saved = JSON.parse(localStorage.getItem('filter_presets') || '{}');
      saved[presetId] = updatedPreset;
      localStorage.setItem('filter_presets', JSON.stringify(saved));
      
      await api.updateFilterPreset(updatedPreset);
      
      setPresets(prev => ({ ...prev, [presetId]: updatedPreset }));
      
      return preset;
    }
    
    return null;
  }, [presets]);
  
  const deletePreset = useCallback(async (presetId) => {
    const saved = JSON.parse(localStorage.getItem('filter_presets') || '{}');
    delete saved[presetId];
    localStorage.setItem('filter_presets', JSON.stringify(saved));
    
    await api.deleteFilterPreset(presetId);
    
    setPresets(prev => {
      const updated = { ...prev };
      delete updated[presetId];
      return updated;
    });
  }, []);
  
  // Load presets on mount
  useEffect(() => {
    const loadStoredPresets = async () => {
      const local = JSON.parse(localStorage.getItem('filter_presets') || '{}');
      const remote = await api.getFilterPresets();
      
      // Merge local and remote presets
      const merged = { ...local, ...remote };
      setPresets(merged);
    };
    
    loadStoredPresets();
  }, []);
  
  return { presets, savePreset, loadPreset, deletePreset };
};
```

## Performance Optimization

### Debounced Filtering
Optimize filter performance with debouncing.

```javascript
const useDebouncedFilters = (filters, delay = 300) => {
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [filters, delay]);
  
  return debouncedFilters;
};
```

### Virtual Scrolling for Large Results
Handle large filter results efficiently.

```jsx
const VirtualizedResultsList = ({ items, itemHeight = 50, maxHeight = 400 }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef();
  
  const visibleItemCount = Math.ceil(maxHeight / itemHeight);
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleItemCount, items.length);
  
  const visibleItems = items.slice(startIndex, endIndex);
  
  return (
    <div
      ref={containerRef}
      style={{ height: maxHeight, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.target.scrollTop)}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        {visibleItems.map((item, index) => (
          <div
            key={startIndex + index}
            style={{
              position: 'absolute',
              top: (startIndex + index) * itemHeight,
              height: itemHeight,
              width: '100%'
            }}
          >
            <ResultItem item={item} />
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Best Practices

### Export Best Practices
1. **Format Selection**: Provide appropriate formats for different use cases
2. **Size Limits**: Implement reasonable size limits with streaming for large exports
3. **Progress Indication**: Show progress for long-running exports
4. **Error Handling**: Gracefully handle export failures and timeouts
5. **Metadata Inclusion**: Include export metadata for context

### Filtering Best Practices
1. **User Experience**: Provide intuitive filter interfaces with clear operators
2. **Performance**: Implement debouncing and efficient query building
3. **Persistence**: Save filter state for user convenience
4. **Validation**: Validate filter inputs to prevent errors
5. **Presets**: Enable saving and sharing of common filter combinations

### Data Handling Best Practices
1. **Sampling**: Use intelligent sampling for large dataset previews
2. **Streaming**: Implement streaming for large exports
3. **Caching**: Cache frequently accessed filter results
4. **Security**: Sanitize data before export to prevent data leaks
5. **Compression**: Use compression for large exports when appropriate

This comprehensive guide provides patterns for implementing robust data export and filtering functionality in observability dashboards, with specific focus on handling large datasets efficiently while maintaining excellent user experience.