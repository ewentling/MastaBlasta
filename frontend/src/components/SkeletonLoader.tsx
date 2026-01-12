import React from 'react';

interface SkeletonLoaderProps {
  type?: 'text' | 'title' | 'avatar' | 'image' | 'button' | 'card';
  count?: number;
  className?: string;
}

export default function SkeletonLoader({ type = 'text', count = 1, className = '' }: SkeletonLoaderProps) {
  const baseClasses = 'animate-pulse bg-gray-700 rounded';
  
  const typeClasses = {
    text: 'h-4 w-full',
    title: 'h-6 w-3/4',
    avatar: 'h-10 w-10 rounded-full',
    image: 'h-48 w-full',
    button: 'h-10 w-24',
    card: 'h-32 w-full',
  };

  const skeletonClass = `${baseClasses} ${typeClasses[type]} ${className}`;

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={skeletonClass} />
      ))}
    </>
  );
}

// Predefined skeleton layouts
export function SkeletonPostCard() {
  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-3">
        <SkeletonLoader type="avatar" />
        <div className="flex-1 space-y-2">
          <SkeletonLoader type="title" className="w-1/3" />
          <SkeletonLoader type="text" className="w-1/4" />
        </div>
      </div>
      <SkeletonLoader type="text" count={3} className="space-y-2" />
      <div className="flex gap-2">
        <SkeletonLoader type="button" />
        <SkeletonLoader type="button" />
      </div>
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex gap-4 p-4 bg-gray-800 rounded-t-lg">
        <SkeletonLoader type="text" className="w-1/4" />
        <SkeletonLoader type="text" className="w-1/4" />
        <SkeletonLoader type="text" className="w-1/4" />
        <SkeletonLoader type="text" className="w-1/4" />
      </div>
      {/* Rows */}
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex gap-4 p-4 bg-gray-800">
          <SkeletonLoader type="text" className="w-1/4" />
          <SkeletonLoader type="text" className="w-1/4" />
          <SkeletonLoader type="text" className="w-1/4" />
          <SkeletonLoader type="text" className="w-1/4" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-gray-800 rounded-lg p-4 space-y-2">
            <SkeletonLoader type="text" className="w-1/2" />
            <SkeletonLoader type="title" />
          </div>
        ))}
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonLoader type="card" className="h-64" />
        <SkeletonLoader type="card" className="h-64" />
      </div>

      {/* Recent Activity */}
      <div className="space-y-2">
        <SkeletonLoader type="title" className="w-1/4" />
        <SkeletonPostCard />
        <SkeletonPostCard />
        <SkeletonPostCard />
      </div>
    </div>
  );
}
