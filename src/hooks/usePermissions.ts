import { useState, useEffect } from 'react';
import { Camera, CameraPermissionState } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export interface PermissionsState {
  camera: CameraPermissionState;
  isLoading: boolean;
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<PermissionsState>({
    camera: 'prompt',
    isLoading: true,
  });

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      // Solo verificar permisos en plataformas nativas
      if (!Capacitor.isNativePlatform()) {
        setPermissions({ camera: 'granted', isLoading: false });
        return;
      }

      const cameraPermissions = await Camera.checkPermissions();
      
      setPermissions({
        camera: cameraPermissions.camera,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error checking permissions:', error);
      setPermissions({ camera: 'denied', isLoading: false });
    }
  };

  const requestCameraPermissions = async (): Promise<boolean> => {
    try {
      // Solo solicitar permisos en plataformas nativas
      if (!Capacitor.isNativePlatform()) {
        return true;
      }

      const result = await Camera.requestPermissions();
      
      setPermissions({
        ...permissions,
        camera: result.camera,
      });

      return result.camera === 'granted';
    } catch (error) {
      console.error('Error requesting camera permissions:', error);
      return false;
    }
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback para navegadores antiguos
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          return successful;
        } catch (err) {
          document.body.removeChild(textArea);
          console.error('Fallback: Oops, unable to copy', err);
          return false;
        }
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      return false;
    }
  };

  const readFromClipboard = async (): Promise<string | null> => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        return text;
      } else {
        console.warn('Clipboard API not available');
        return null;
      }
    } catch (error) {
      console.error('Error reading from clipboard:', error);
      return null;
    }
  };

  return {
    permissions,
    requestCameraPermissions,
    checkPermissions,
    copyToClipboard,
    readFromClipboard,
  };
}
