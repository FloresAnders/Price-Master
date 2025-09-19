import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import HomeMenu from './HomeMenu';

export default function ClientOnlyHomeMenu() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-8">
        <div className="text-center">
          <p>Cargando menú personalizado...</p>
        </div>
      </div>
    );
  }

  return <HomeMenu currentUser={user} />;
}
