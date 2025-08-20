"use client";

import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: 'rectangular' | 'rounded' | 'circular';
  animation?: 'pulse' | 'wave' | 'none';
  children?: React.ReactNode;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  variant = 'rectangular',
  animation = 'pulse',
  children
}) => {
  const baseClasses = 'bg-bg-tertiary';
  
  const variantClasses = {
    rectangular: 'rounded',
    rounded: 'rounded-md',
    circular: 'rounded-full'
  };
  
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-pulse', // Could implement wave animation later
    none: ''
  };
  
  const style = {
    ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height && { height: typeof height === 'number' ? `${height}px` : height })
  };
  
  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
};

// Event Card Skeleton for loading states
export const EventCardSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={`p-4 border border-border rounded-lg bg-bg-secondary ${className}`}>
      <div className="flex items-start space-x-3">
        {/* Event type badge skeleton */}
        <Skeleton width={80} height={20} variant="rounded" />
        
        <div className="flex-1 space-y-2">
          {/* Title skeleton */}
          <Skeleton width="60%" height={16} />
          
          {/* Metadata skeleton */}
          <div className="flex space-x-4">
            <Skeleton width={100} height={14} />
            <Skeleton width={80} height={14} />
            <Skeleton width={60} height={14} />
          </div>
          
          {/* Content preview skeleton */}
          <div className="space-y-1">
            <Skeleton width="90%" height={12} />
            <Skeleton width="70%" height={12} />
          </div>
        </div>
        
        {/* Timestamp skeleton */}
        <Skeleton width={60} height={14} />
      </div>
    </div>
  );
};

// Stats skeleton for dashboard header
export const StatsGridSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="text-center space-y-1">
          <Skeleton width={48} height={24} className="mx-auto" />
          <Skeleton width={80} height={14} className="mx-auto" />
        </div>
      ))}
    </div>
  );
};

// Feed loading skeleton
export const EventFeedSkeleton: React.FC<{ count?: number; className?: string }> = ({ 
  count = 5, 
  className 
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <EventCardSkeleton key={index} />
      ))}
    </div>
  );
};