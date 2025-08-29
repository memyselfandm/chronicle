'use client';

import React from 'react';
import { config, configUtils } from '@/lib/config';

/**
 * Mode indicator component that shows the current backend mode
 * Displays in the dashboard header to inform users which backend is active
 */
export function ModeIndicator() {
  const { backend } = config;
  
  const getModeDisplay = () => {
    switch (backend.mode) {
      case 'local':
        return {
          label: 'Local',
          color: 'bg-blue-500',
          textColor: 'text-blue-100',
          icon: '🏠',
          tooltip: `Local server at ${backend.local?.serverUrl || 'http://localhost:8510'}`,
        };
      case 'supabase':
        return {
          label: 'Supabase',
          color: 'bg-green-500', 
          textColor: 'text-green-100',
          icon: '☁️',
          tooltip: `Connected to ${backend.supabase?.url || 'Supabase'}`,
        };
      default:
        return {
          label: 'Unknown',
          color: 'bg-gray-500',
          textColor: 'text-gray-100', 
          icon: '❓',
          tooltip: 'Unknown backend mode',
        };
    }
  };

  const mode = getModeDisplay();

  return (
    <div 
      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${mode.color} ${mode.textColor}`}
      title={mode.tooltip}
    >
      <span className="text-xs">{mode.icon}</span>
      <span>{mode.label}</span>
    </div>
  );
}

/**
 * Detailed mode indicator with more information
 * Shows additional backend configuration details
 */
export function DetailedModeIndicator() {
  const { backend } = config;
  
  const getModeDetails = () => {
    switch (backend.mode) {
      case 'local':
        return {
          title: 'Local Backend',
          subtitle: backend.local?.serverUrl || 'http://localhost:8510',
          color: 'border-blue-500',
          bgColor: 'bg-blue-500/10',
          textColor: 'text-blue-400',
          icon: '🏠',
        };
      case 'supabase':
        const url = backend.supabase?.url || '';
        const shortUrl = url.replace('https://', '').replace('.supabase.co', '');
        return {
          title: 'Supabase Backend',
          subtitle: shortUrl || 'Supabase Cloud',
          color: 'border-green-500',
          bgColor: 'bg-green-500/10',
          textColor: 'text-green-400',
          icon: '☁️',
        };
      default:
        return {
          title: 'Unknown Backend',
          subtitle: 'Configuration error',
          color: 'border-gray-500',
          bgColor: 'bg-gray-500/10',
          textColor: 'text-gray-400',
          icon: '❓',
        };
    }
  };

  const mode = getModeDetails();

  return (
    <div className={`flex items-center gap-2 p-2 border rounded-lg ${mode.color} ${mode.bgColor}`}>
      <span className="text-lg">{mode.icon}</span>
      <div className="flex flex-col">
        <span className={`text-sm font-medium ${mode.textColor}`}>
          {mode.title}
        </span>
        <span className="text-xs text-text-muted">
          {mode.subtitle}
        </span>
      </div>
    </div>
  );
}

export default ModeIndicator;