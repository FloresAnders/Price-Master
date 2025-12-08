'use client';

import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import versionData from '../data/version.json';

export function useVersion() {
  const [version, setVersion] = useState<string>(versionData.version);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Obtener la versión una sola vez al cargar, sin suscripción en tiempo real
    const fetchVersion = async () => {
      try {
        const versionRef = doc(db, 'version', 'current');
        const docSnap = await getDoc(versionRef);
        
        if (docSnap.exists()) {
          const serverVersion = docSnap.data().version;
          setVersion(serverVersion || versionData.version);
        } else {
          // Si no existe en la base de datos, usar la versión local
          setVersion(versionData.version);
        }
      } catch (error) {
        console.error('Error obteniendo versión:', error);
        // En caso de error, usar la versión local
        setVersion(versionData.version);
      } finally {
        setLoading(false);
      }
    };

    fetchVersion();
  }, []); // Solo se ejecuta una vez al montar el componente

  return { version, loading };
}
