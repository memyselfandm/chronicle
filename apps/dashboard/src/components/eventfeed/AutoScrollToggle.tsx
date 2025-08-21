/**
 * AutoScrollToggle - Control component for auto-scroll behavior
 * 
 * Features:
 * - Toggle auto-scroll on/off
 * - Visual indicator of current state
 * - Keyboard accessible
 * - Tooltip for user guidance
 */

'use client';

import React, { memo } from 'react';
import { cn } from '@/lib/utils';

export interface AutoScrollToggleProps {
  /** Whether auto-scroll is currently enabled */
  enabled: boolean;
  /** Callback when auto-scroll state changes */
  onChange?: (enabled: boolean) => void;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * Auto-scroll toggle control for event feed
 */
export const AutoScrollToggle = memo<AutoScrollToggleProps>(({
  enabled,
  onChange,
  className,
  size = 'sm'
}) => {
  const handleToggle = () => {
    onChange?.(!enabled);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        // Base styling
        'inline-flex items-center gap-1.5 rounded-md border transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-1',
        
        // Size variants
        size === 'sm' && 'px-2 py-1 text-xs',
        size === 'md' && 'px-3 py-1.5 text-sm',
        
        // State-dependent styling
        enabled 
          ? 'bg-accent-blue text-white border-accent-blue hover:bg-accent-blue/90'
          : 'bg-bg-secondary text-text-muted border-border-primary hover:bg-bg-tertiary hover:text-text-secondary',
        
        className
      )}
      data-testid="auto-scroll-toggle"
      aria-label={`Auto-scroll is ${enabled ? 'enabled' : 'disabled'}. Click to ${enabled ? 'disable' : 'enable'}.`}
      aria-pressed={enabled}
      title={enabled ? 'Disable auto-scroll' : 'Enable auto-scroll'}
    >
      <span className={cn('material-icons', size === 'sm' ? 'text-sm' : 'text-base')}>
        {enabled ? 'pause' : 'play_arrow'}
      </span>
      <span className="font-medium">
        {enabled ? 'Auto' : 'Manual'}
      </span>
    </button>
  );
});

AutoScrollToggle.displayName = 'memo(AutoScrollToggle)';