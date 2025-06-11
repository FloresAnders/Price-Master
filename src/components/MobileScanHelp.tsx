'use client';

import React, { useState } from 'react';
import { Smartphone, Wifi, QrCode, Bell, Copy, ExternalLink } from 'lucide-react';
import { generateQRCodeUrl, copyToClipboard } from '../utils/qrUtils';

interface MobileScanHelpProps {
  mobileUrl: string;
  sessionId: string;
}

export default function MobileScanHelp({ mobileUrl, sessionId }: MobileScanHelpProps) {
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopyToClipboard = async (text: string) => {
    try {
      await copyToClipboard(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  };

  const qrCodeUrl = generateQRCodeUrl(mobileUrl, 150);

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
      <div className="flex items-center gap-2 mb-3">
        <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h3 className="font-semibold text-blue-900 dark:text-blue-100">
          ¿Cómo usar el escaneo móvil?
        </h3>
      </div>
      
      <div className="space-y-3 text-blue-800 dark:text-blue-200">        <div className="flex gap-3">
          <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
          <div className="flex-1">
            <strong>Escanea el código QR o copia la URL:</strong>
            <div className="mt-2 flex flex-col sm:flex-row gap-3 items-start">
              <div className="flex-1">
                <div className="p-2 bg-white dark:bg-gray-800 rounded border">
                  <code className="text-xs break-all text-gray-800 dark:text-gray-200">{mobileUrl}</code>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleCopyToClipboard(mobileUrl)}
                    className={`text-xs px-3 py-1 rounded flex items-center gap-1 transition-colors ${
                      copySuccess 
                        ? 'bg-green-500 text-white' 
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                  >
                    <Copy className="w-3 h-3" />
                    {copySuccess ? 'Copiado!' : 'Copiar URL'}
                  </button>
                  <button
                    onClick={() => window.open(mobileUrl, '_blank')}
                    className="text-xs bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Abrir
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="bg-white p-2 rounded border shadow-sm">                  <img 
                    src={qrCodeUrl} 
                    alt="QR Code" 
                    className="w-24 h-24"
                    onError={(e) => {
                      // Fallback to simple QR icon if API fails
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) {
                        fallback.style.display = 'flex';
                      }
                    }}
                  />
                  <div className="hidden items-center justify-center w-24 h-24 bg-gray-100 rounded">
                    <QrCode className="w-12 h-12 text-gray-500" />
                  </div>
                </div>
                <p className="text-xs text-center mt-1 text-blue-700 dark:text-blue-300">
                  Escanea con tu móvil
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3">
          <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
          <div>
            <strong>Escanea códigos de barras</strong> con la cámara de tu móvil o introduce códigos manualmente.
          </div>
        </div>
        
        <div className="flex gap-3">
          <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
          <div>
            Los códigos aparecerán <strong>automáticamente aquí</strong> en tiempo real. <Bell className="w-4 h-4 inline text-orange-500" />
          </div>
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-800/50 rounded-lg">
        <div className="flex items-center gap-2 mb-1">
          <Wifi className="w-4 h-4 text-green-600" />
          <span className="text-xs font-semibold text-blue-900 dark:text-blue-100">Conexión en tiempo real</span>
        </div>
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Asegúrate de que ambos dispositivos estén conectados a internet. 
          Los códigos se sincronizan instantáneamente.
        </p>
      </div>
      
      <div className="mt-3 text-xs text-blue-600 dark:text-blue-400">
        <strong>ID de sesión:</strong> <code className="bg-white dark:bg-gray-800 px-1 rounded">{sessionId}</code>
      </div>
    </div>
  );
}
