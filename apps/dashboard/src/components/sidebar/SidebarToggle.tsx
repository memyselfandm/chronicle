'use client';

import React from 'react';
import { useDashboardStore } from '@/stores/dashboardStore';

/**
 * Sidebar toggle button with hamburger icon
 * Supports Cmd+B keyboard shortcut and smooth animations
 */
export function SidebarToggle() {
  const { ui: { sidebarCollapsed }, setSidebarCollapsed } = useDashboardStore();

  const handleToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <button
      onClick={handleToggle}
      className="flex items-center justify-center w-7 h-7 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded transition-colors"
      title={`${sidebarCollapsed ? 'Expand' : 'Collapse'} sidebar (Cmd+B)`}
      aria-label={`${sidebarCollapsed ? 'Expand' : 'Collapse'} sidebar`}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        {sidebarCollapsed ? (
          // Expand icon (arrow right)
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        ) : (
          // Hamburger menu icon
          <>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </>
        )}
      </svg>
    </button>
  );
}