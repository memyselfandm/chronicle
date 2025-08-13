"use client";

import { useState, useEffect } from "react";

type ConnectionStatus = "Connected" | "Disconnected" | "Connecting";

export function Header() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("Connecting");
  const [eventCount] = useState(0);

  // Simulate connection status for now - will be replaced with real Supabase connection
  useEffect(() => {
    const timer = setTimeout(() => {
      setConnectionStatus("Disconnected");
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case "Connected":
        return "bg-accent-green";
      case "Disconnected":
        return "bg-accent-red";
      case "Connecting":
        return "bg-accent-yellow";
      default:
        return "bg-accent-yellow";
    }
  };

  const getStatusAnimation = (status: ConnectionStatus) => {
    return status === "Connecting" ? "animate-pulse" : "";
  };

  return (
    <header className="bg-bg-secondary border-b border-border">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Chronicle title and logo area */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-accent-blue rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-text-primary">
                  Chronicle
                </h1>
                <p className="text-sm text-text-muted">
                  Multi-Agent Observability
                </p>
              </div>
            </div>
          </div>

          {/* Right: Connection status and event counter */}
          <div className="flex items-center space-x-6">
            {/* Event counter */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-text-secondary">Events:</span>
              <span className="text-lg font-semibold text-text-primary">
                {eventCount.toLocaleString()}
              </span>
            </div>

            {/* Connection status indicator */}
            <div className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full ${getStatusColor(connectionStatus)} ${getStatusAnimation(connectionStatus)}`}
                aria-label={`Connection status: ${connectionStatus}`}
              />
              <span className="text-sm font-medium text-text-secondary">
                {connectionStatus}
              </span>
            </div>

            {/* Future: Basic navigation placeholder */}
            <nav className="flex items-center space-x-4">
              <button
                className="text-sm text-text-muted hover:text-text-secondary transition-colors duration-200"
                title="Settings (Coming Soon)"
                disabled
              >
                Settings
              </button>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}