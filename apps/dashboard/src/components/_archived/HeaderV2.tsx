"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { MetricsDisplay } from './MetricsDisplay';
import { ConnectionDot } from './ConnectionDot';

/**
 * HeaderV2 - Real-time Dashboard Header Component
 * 
 * Key requirements from consolidated guidance:
 * - Height: 32-40px (minimal for maximum content space)
 * - Title left: "Chronicle Dashboard"
 * - Right section: connection status, key metrics
 * - Professional dark theme colors
 * - Real-time updates without performance impact
 */

interface HeaderV2Props {
  className?: string;
}

export function HeaderV2({ className }: HeaderV2Props) {
  return (
    <header 
      className={cn(
        "bg-bg-secondary border-b border-border",
        "h-10", // 40px fixed height per guidance
        "flex items-center justify-between",
        "px-6 py-0", // Minimal padding for height constraint
        "sticky top-0 z-50", // Fixed positioning during scroll
        className
      )}
      data-testid="header-v2"
    >
      {/* Left Section: Chronicle Dashboard Title */}
      <div className="flex items-center">
        <h1 className="text-lg font-semibold text-text-primary">
          Chronicle Dashboard
        </h1>
      </div>

      {/* Right Section: Metrics and Connection Status */}
      <div className="flex items-center gap-4">
        {/* Real-time Metrics */}
        <MetricsDisplay />
        
        {/* Connection Status */}
        <ConnectionDot />
      </div>
    </header>
  );
}