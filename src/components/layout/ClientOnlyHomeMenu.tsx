'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { useAuth } from '../../hooks/useAuth';

// Import HomeMenu dynamically with SSR disabled to prevent hydration errors
const HomeMenu = dynamic(() => import('./HomeMenu'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-8">
      <div className="mb-2 flex items-center justify-center">
        <div className="w-14 h-14 mr-2 bg-gray-200 rounded animate-pulse"></div>
      </div>
      <div className="h-8 bg-gray-200 rounded w-64 mb-8 animate-pulse"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-screen-xl">
        {[...Array(8)].map((_, index) => (
          <div
            key={index}
            className="bg-gray-200 rounded-xl p-6 animate-pulse"
            style={{ minHeight: 160 }}
          >
            <div className="w-10 h-10 bg-gray-300 rounded mb-3 mx-auto"></div>
            <div className="h-4 bg-gray-300 rounded mb-2"></div>
            <div className="h-3 bg-gray-300 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  )
});

export default function ClientOnlyHomeMenu() {
  const { user, isAuthenticated } = useAuth();

  // Only render if user is authenticated to ensure proper permission filtering
  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-8">
        <div className="text-center text-[var(--muted-foreground)]">
          <p>Cargando menú personalizado...</p>
        </div>
      </div>
    );
  }

  return <HomeMenu currentUser={user} />;
}
