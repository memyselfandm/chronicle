'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useDashboardStore } from '@/stores/dashboardStore';
import { supabase } from '@/lib/supabase';

export function Header() {
  const { sessions, events } = useDashboardStore();
  
  // Connection status
  const [isConnected, setIsConnected] = useState(true);
  const [latency, setLatency] = useState(0);
  
  // Sparkline canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [eventRateHistory, setEventRateHistory] = useState<number[]>(new Array(30).fill(0));
  
  // Calculate metrics
  const metrics = useMemo(() => {
    const activeSessions = sessions.filter(s => s.status === 'active').length;
    const awaitingSessions = sessions.filter(s => s.status === 'awaiting').length;
    
    // Calculate events per minute from recent events
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentEvents = events.filter(e => e.timestamp.getTime() > oneMinuteAgo);
    const eventsPerMinute = recentEvents.length;
    
    return {
      active: activeSessions,
      awaiting: awaitingSessions,
      eventsPerMin: eventsPerMinute
    };
  }, [sessions, events]);
  
  // Monitor connection status
  useEffect(() => {
    // Check connection periodically
    const checkConnection = async () => {
      try {
        const start = Date.now();
        const { error } = await supabase.from('chronicle_sessions').select('id').limit(1);
        const end = Date.now();
        
        if (!error) {
          setIsConnected(true);
          setLatency(end - start);
        } else {
          setIsConnected(false);
        }
      } catch {
        setIsConnected(false);
      }
    };
    
    checkConnection();
    const interval = setInterval(checkConnection, 10000); // Check every 10 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  // Update event rate history for sparkline
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const twoSecondsAgo = now - 2000;
      const recentEvents = events.filter(e => e.timestamp.getTime() > twoSecondsAgo);
      const rate = (recentEvents.length / 2) * 60; // Convert to per minute
      
      setEventRateHistory(prev => {
        const newHistory = [...prev.slice(1), rate];
        return newHistory;
      });
    }, 2000); // Update every 2 seconds
    
    return () => clearInterval(interval);
  }, [events]);
  
  // Draw sparkline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size for high DPI
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    // Skip if no data
    if (eventRateHistory.every(v => v === 0)) return;
    
    // Find max value for scaling
    const maxValue = Math.max(...eventRateHistory, 1);
    const padding = 2;
    const width = rect.width - padding * 2;
    const height = rect.height - padding * 2;
    
    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(72, 187, 120, 0.3)');
    gradient.addColorStop(1, 'rgba(72, 187, 120, 0.05)');
    
    ctx.beginPath();
    ctx.moveTo(padding, height + padding);
    
    eventRateHistory.forEach((value, index) => {
      const x = padding + (index / (eventRateHistory.length - 1)) * width;
      const y = padding + height - (value / maxValue) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    // Complete the fill area
    ctx.lineTo(padding + width, height + padding);
    ctx.lineTo(padding, height + padding);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw line
    ctx.beginPath();
    eventRateHistory.forEach((value, index) => {
      const x = padding + (index / (eventRateHistory.length - 1)) * width;
      const y = padding + height - (value / maxValue) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.strokeStyle = '#48bb78';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
  }, [eventRateHistory]);

  return (
    <header className="h-10 bg-bg-secondary border-b border-border-primary flex items-center justify-between px-4">
      {/* Left side: Title and connection status */}
      <div className="flex items-center gap-6">
        <h1 className="text-base font-semibold text-white">Chronicle Dashboard</h1>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-text-muted">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
      
      {/* Right side: Metrics */}
      <div className="flex items-center gap-3">
        {/* Active sessions */}
        <div className="flex items-center gap-1 text-xs">
          <span className="material-icons" style={{ fontSize: '14px', color: '#4299e1' }}>play_circle_filled</span>
          <span className="text-white font-medium">{metrics.active}</span>
        </div>
        
        {/* Awaiting input */}
        <div className="flex items-center gap-1 text-xs">
          <span className="material-icons" style={{ fontSize: '14px', color: '#f6ad55' }}>notification_important</span>
          <span className={metrics.awaiting > 0 ? 'text-yellow-400 font-medium' : 'text-text-muted'}>
            {metrics.awaiting}
          </span>
        </div>
        
        {/* Latency */}
        <div className="flex items-center gap-1 text-xs">
          <span className="material-icons" style={{ fontSize: '14px', color: '#4299e1' }}>speed</span>
          <span className="text-text-muted">{latency}ms</span>
        </div>
        
        {/* Event rate with sparkline */}
        <div 
          className="flex items-center gap-2 px-2 py-1"
          style={{
            background: 'rgba(26, 31, 46, 0.8)',
            border: '1px solid rgb(45, 55, 72)',
            borderRadius: '6px'
          }}
        >
          <div className="flex items-center gap-1">
            <span className="material-icons" style={{ fontSize: '14px', color: '#48bb78' }}>trending_up</span>
            <span className="text-xs text-text-muted">{metrics.eventsPerMin}/min</span>
          </div>
          <canvas 
            ref={canvasRef}
            className="rounded"
            style={{ 
              width: '80px',
              height: '20px',
              imageRendering: 'crisp-edges',
              background: 'rgba(15, 20, 25, 0.5)'
            }}
          />
        </div>
      </div>
    </header>
  );
}