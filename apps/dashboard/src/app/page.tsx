'use client';

import { DashboardLayout } from "@/components/DashboardLayout";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useLayoutPersistence } from "@/lib/layoutPersistence";
import { useEffect } from 'react';
import { useDashboardStore } from '@/stores/dashboardStore';

export default function Dashboard() {
  // Initialize keyboard navigation
  const { isNavigationActive } = useKeyboardNavigation({
    enableEventNavigation: true,
    enableFilterShortcuts: true,
    enableSidebarShortcut: true,
    enableSearchShortcut: true,
    enableEscapeToClear: true,
    preventDefault: true
  });

  // Initialize layout persistence
  const { layoutState, isLoaded } = useLayoutPersistence();
  const { setSidebarCollapsed } = useDashboardStore();

  // Restore layout state on mount
  useEffect(() => {
    if (isLoaded && layoutState) {
      setSidebarCollapsed(layoutState.sidebarCollapsed);
    }
  }, [isLoaded, layoutState, setSidebarCollapsed]);

  return (
    <DashboardLayout
      className={isNavigationActive ? 'navigation-active' : ''}
      persistLayout={true}
      enableKeyboardShortcuts={true}
    >
      {/* DashboardLayout now handles data fetching internally */}
    </DashboardLayout>
  );
}
