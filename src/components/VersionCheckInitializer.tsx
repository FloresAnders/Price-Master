"use client";

import { useEffect } from 'react';
import { startVersionCheck, stopVersionCheck } from '../utils/versionChecker';

export default function VersionCheckInitializer() {
  useEffect(() => {
    // Iniciar verificación de versión en tiempo real
    startVersionCheck();

    // Limpiar al desmontar el componente
    return () => {
      stopVersionCheck();
    };
  }, []);

  return null; // Este componente no renderiza nada
}
