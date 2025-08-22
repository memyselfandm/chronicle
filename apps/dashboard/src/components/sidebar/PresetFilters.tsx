'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useSessions } from '@/hooks/useSessions';

/**
 * Preset filter buttons for quick access
 * Supports keyboard shortcuts (1/2/3/4/5) and connects to Zustand store
 */
export function PresetFilters() {
  const { 
    filters, 
    updateFilters, 
    sessions,
    events
  } = useDashboardStore();
  
  const { fetchSessions } = useSessions();
  const [selectedTimeRange, setSelectedTimeRange] = useState(20); // Default 20 minutes

  // Define filter presets
  const presets = [
    {
      id: 'all',
      label: 'All',
      shortcut: '1',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      filter: () => ({ sessionStatus: [], eventTypes: [] }),
      count: sessions.length
    },
    {
      id: 'active',
      label: 'Active',
      shortcut: '2',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      filter: () => ({ sessionStatus: ['active'] }),
      count: sessions.filter(s => s.status === 'active').length
    },
    {
      id: 'awaiting',
      label: 'Awaiting',
      shortcut: '3',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5a7.5 7.5 0 011.5 0z" />
        </svg>
      ),
      filter: () => {
        // Get sessions where last event is notification requiring response
        const awaitingSessions = sessions.filter(session => {
          const sessionEvents = events.filter(e => e.sessionId === session.id);
          const lastEvent = sessionEvents
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
          return lastEvent?.type === 'notification' && 
            lastEvent?.metadata?.requires_response === true;
        });
        return { sessionStatus: awaitingSessions.map(s => s.id) };
      },
      count: (() => {
        return sessions.filter(session => {
          const sessionEvents = events.filter(e => e.sessionId === session.id);
          const lastEvent = sessionEvents
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
          return lastEvent?.type === 'notification' && 
            lastEvent?.metadata?.requires_response === true;
        }).length;
      })()
    },
    {
      id: 'errors',
      label: 'Errors',
      shortcut: '4',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
      filter: () => ({ eventTypes: ['error'] }),
      count: events.filter(e => e.type === 'error').length
    },
    {
      id: 'recent',
      label: 'Recent',
      shortcut: '5',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      filter: () => {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return { 
          dateRange: { 
            start: oneHourAgo,
            end: new Date()
          } 
        };
      },
      count: events.filter(e => new Date(e.timestamp) >= new Date(Date.now() - 60 * 60 * 1000)).length
    }
  ];

  // Check if a preset is currently active
  const isActive = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return false;

    const presetFilter = preset.filter();
    
    // Simple check - in real implementation would need deep comparison
    if (presetId === 'all') {
      return filters.sessionStatus.length === 0 && filters.eventTypes.length === 0;
    }
    
    return false; // Simplified for now
  };

  // Handle preset selection
  const selectPreset = useCallback((presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      const newFilter = preset.filter();
      updateFilters(newFilter);
    }
  }, [updateFilters, presets]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Only handle if no modifier keys and not in input
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

    const shortcut = event.key;
    const preset = presets.find(p => p.shortcut === shortcut);
    if (preset) {
      event.preventDefault();
      selectPreset(preset.id);
    }
  }, [selectPreset, presets]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Time range options
  const timeRanges = [
    { label: 'Active (5m)', value: 5 },
    { label: 'Recent (20m)', value: 20 },
    { label: 'Hour', value: 60 },
    { label: 'Today', value: 1440 },
  ];

  // Handle time range change
  const handleTimeRangeChange = useCallback(async (minutes: number) => {
    setSelectedTimeRange(minutes);
    updateFilters({ timeRangeMinutes: minutes });
    await fetchSessions(minutes); // Refetch sessions with new time range
  }, [updateFilters, fetchSessions]);

  // Temporarily commented out as per requirements
  return null;
  
  /* Original implementation preserved for future use
  return (
    <div className="p-3">
      {/* Time Range Selector *}
      <h3 className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
        Activity Range
      </h3>
      
      <div className="grid grid-cols-2 gap-1 mb-4">
        {timeRanges.map((range) => (
          <button
            key={range.value}
            onClick={() => handleTimeRangeChange(range.value)}
            className={`
              px-2 py-1.5 text-xs rounded-md transition-colors
              ${
                selectedTimeRange === range.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }
            `}
            title={`Show sessions active in last ${range.label}`}
          >
            {range.label}
          </button>
        ))}
      </div>

      <h3 className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
        Quick Filters
      </h3>
      
      <div className="grid grid-cols-1 gap-1">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => selectPreset(preset.id)}
            className={`
              flex items-center justify-between p-2 rounded-lg text-sm transition-colors
              ${isActive(preset.id)
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/50'
                : 'text-gray-300 hover:text-gray-200 hover:bg-gray-800'
              }
            `}
            title={`${preset.label} (Press ${preset.shortcut})`}
          >
            <div className="flex items-center space-x-2">
              <div className="flex-shrink-0">
                {preset.icon}
              </div>
              <span>{preset.label}</span>
            </div>
            
            <div className="flex items-center space-x-1">
              <span className="text-xs text-gray-500">
                {preset.count}
              </span>
              <kbd className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
                {preset.shortcut}
              </kbd>
            </div>
          </button>
        ))}
      </div>

      {/* Clear filters button *}
      <button
        onClick={() => updateFilters({
          dateRange: {},
          eventTypes: [],
          sessionStatus: [],
          searchTerm: ''
        })}
        className="w-full mt-2 p-2 text-xs text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
      >
        Clear All Filters
      </button>
    </div>
  );
  */
}