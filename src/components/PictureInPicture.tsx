'use client';
import React, { useRef, useEffect } from 'react';
import { Maximize as MaximizeIcon, X as XIcon } from 'lucide-react';

interface PictureInPictureProps {
  isOpen: boolean;
  code: string | null;
  onToggle: () => void;
  onProcessImage: (imageData: string) => void;
  onRemoveLeadingZero?: (code: string) => void;
}

export function PictureInPicture({
  isOpen,
  code,
  onToggle,
  onProcessImage,
  onRemoveLeadingZero
}: PictureInPictureProps) {
  const pipWindowRef = useRef<Window | null>(null);
  const closingRef = useRef<boolean>(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const openPictureInPicture = async () => {
    closingRef.current = false; // Reset flag cuando se abre
    
    // Verificar soporte para Picture-in-Picture
    // @ts-expect-error - documentPictureInPicture is experimental
    if (!window.documentPictureInPicture) {
      alert('Tu navegador no soporta Picture-in-Picture. Usa Chrome 116+ o Edge 116+');
      return;
    }

    try {
      // @ts-expect-error - documentPictureInPicture is experimental
      const pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 320,
        height: 180,
      });

      pipWindowRef.current = pipWindow;

      // Obtener tema actual
      const isDarkMode = document.documentElement.classList.contains('dark') ||
                        document.body.classList.contains('dark') ||
                        window.matchMedia('(prefers-color-scheme: dark)').matches;

      // Copiar estilos críticos
      const styles = `
        <style>
          * { box-sizing: border-box; }
          body { 
            margin: 0; 
            padding: 12px; 
            font-family: system-ui, -apple-system, sans-serif; 
            background: ${isDarkMode ? '#1f2937' : '#ffffff'};
            color: ${isDarkMode ? '#f9fafb' : '#111827'};
            min-height: 100vh;
            font-size: 13px;
          }
          .container { display: flex; flex-direction: column; height: 100%; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
          .title { font-weight: bold; font-size: 12px; }
          .close-btn { 
            background: #ef4444; border: none; color: white; border-radius: 50%; 
            width: 20px; height: 20px; cursor: pointer; font-size: 12px;
          }
          .code-container { 
            background: ${isDarkMode ? '#374151' : '#f3f4f6'}; 
            padding: 8px; border-radius: 6px; margin-bottom: 8px; 
            border: 2px solid ${isDarkMode ? '#6b7280' : '#d1d5db'};
          }
          .code-container.has-code { border-color: #22c55e; }
          .code-display { 
            font-family: monospace; font-weight: bold; text-align: center; 
            font-size: 11px; word-break: break-all; margin: 4px 0;
          }
          .buttons { display: flex; gap: 4px; }
          .btn { 
            flex: 1; padding: 4px 6px; border: none; border-radius: 4px; 
            cursor: pointer; font-size: 10px; font-weight: bold;
          }
          .btn-copy { background: #22c55e; color: white; }
          .btn-copy:hover { background: #16a34a; }
          .btn-remove { background: #f59e0b; color: white; }
          .btn-remove:hover { background: #d97706; }
          .instructions { 
            text-align: center; font-size: 10px; 
            color: ${isDarkMode ? '#9ca3af' : '#6b7280'}; 
            padding: 6px; background: ${isDarkMode ? '#374151' : '#f9fafb'}; 
            border-radius: 4px; margin-top: auto;
          }
          .hidden { display: none !important; }
        </style>
      `;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Escáner PiP</title>
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="header">
              <span class="title">📱 Escáner</span>
              <button class="close-btn" onclick="closeWindow()">×</button>
            </div>
            
            <div id="code-container" class="code-container">
              <div id="code-display" class="code-display">Sin código detectado</div>
              <div id="buttons" class="buttons hidden">
                <button id="copy-btn" class="btn btn-copy">📋 Copiar</button>
                <button id="remove-btn" class="btn btn-remove">← Borrar 1°</button>
              </div>
            </div>
            
            <div class="instructions">
              Usa Ctrl+V para pegar imagen
            </div>
          </div>
          
          <script>
            let currentCode = null;
            
            // Elements
            const codeContainer = document.getElementById('code-container');
            const codeDisplay = document.getElementById('code-display');
            const buttons = document.getElementById('buttons');
            const copyBtn = document.getElementById('copy-btn');
            const removeBtn = document.getElementById('remove-btn');
            
            // Close window function
            function closeWindow() {
              // Notify parent before closing
              if (window.opener) {
                window.opener.postMessage({ type: 'PIP_CLOSED' }, '*');
              }
              window.close();
            }
            
            // Update code display
            function updateCode(code) {
              currentCode = code;
              if (code) {
                codeContainer.classList.add('has-code');
                codeDisplay.textContent = code;
                buttons.classList.remove('hidden');
              } else {
                codeContainer.classList.remove('has-code');
                codeDisplay.textContent = 'Sin código detectado';
                buttons.classList.add('hidden');
              }
            }
            
            // Copy functionality
            copyBtn.addEventListener('click', () => {
              if (currentCode) {
                navigator.clipboard.writeText(currentCode).then(() => {
                  copyBtn.textContent = '✅ ¡Copiado!';
                  setTimeout(() => {
                    copyBtn.textContent = '📋 Copiar';
                  }, 1500);
                });
              }
            });
            
            // Remove first digit
            removeBtn.addEventListener('click', () => {
              if (currentCode && currentCode.length > 1 && currentCode[0] === '0') {
                const newCode = currentCode.slice(1);
                updateCode(newCode);
                // Send message to parent
                if (window.opener) {
                  window.opener.postMessage({ 
                    type: 'PIP_REMOVE_LEADING_ZERO', 
                    code: newCode 
                  }, '*');
                }
              }
            });
            
            // Handle paste (Ctrl+V)
            document.addEventListener('paste', (e) => {
              if (e.clipboardData?.items) {
                for (const item of e.clipboardData.items) {
                  if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                      codeDisplay.textContent = '⏳ Procesando...';
                      // Send image to parent for processing
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        if (window.opener) {
                          window.opener.postMessage({
                            type: 'PIP_PROCESS_IMAGE',
                            imageData: event.target.result
                          }, '*');
                        }
                      };
                      reader.readAsDataURL(file);
                      e.preventDefault();
                      break;
                    }
                  }
                }
              }
            });
            
            // Window close handlers - múltiples eventos para mayor confiabilidad
            function notifyParentClosed() {
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({ type: 'PIP_CLOSED' }, '*');
              }
            }
            
            window.addEventListener('beforeunload', notifyParentClosed);
            window.addEventListener('unload', notifyParentClosed);
            window.addEventListener('pagehide', notifyParentClosed);
            
            // Listen for updates from parent
            window.addEventListener('message', (event) => {
              if (event.data.type === 'PIP_UPDATE_CODE') {
                updateCode(event.data.code);
              }
            });
          </script>
        </body>
        </html>
      `;
      
      pipWindow.document.write(html);
      pipWindow.document.close();

      // Initial code update
      if (code) {
        setTimeout(() => {
          pipWindow.postMessage({ type: 'PIP_UPDATE_CODE', code }, '*');
        }, 100);
      }

      // Handle window closing
      checkIntervalRef.current = setInterval(() => {
        if (pipWindow.closed) {
          pipWindowRef.current = null;
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }
          // Solo notificar si no se está cerrando manualmente
          if (!closingRef.current) {
            onToggle(); // Notify parent that PiP closed
          }
          closingRef.current = false; // Reset flag
        }
      }, 300); // Check más frecuentemente

    } catch (error) {
      console.error('Error opening Picture-in-Picture:', error);
      alert('Error al abrir ventana Picture-in-Picture');
    }
  };

  const closePictureInPicture = () => {
    closingRef.current = true; // Marcar que se está cerrando manualmente
    
    // Limpiar el intervalo
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
    }
    pipWindowRef.current = null;
    
    // Inmediatamente notificar al padre que se cerró
    onToggle();
    
    // Reset flag después de un momento
    setTimeout(() => {
      closingRef.current = false;
    }, 100);
  };

  const togglePictureInPicture = async () => {
    if (isOpen) {
      closePictureInPicture();
    } else {
      await openPictureInPicture();
    }
  };

  // Listen for messages from PiP window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'PIP_CLOSED') {
        onToggle();
      } else if (event.data.type === 'PIP_PROCESS_IMAGE') {
        onProcessImage(event.data.imageData);
      } else if (event.data.type === 'PIP_REMOVE_LEADING_ZERO') {
        onRemoveLeadingZero?.(event.data.code);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onToggle, onProcessImage, onRemoveLeadingZero]);

  // Update PiP when code changes
  useEffect(() => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.postMessage({ type: 'PIP_UPDATE_CODE', code }, '*');
    }
  }, [code]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Limpiar intervalo al desmontar
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      // Cerrar ventana PiP al desmontar
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.close();
      }
    };
  }, []);

  return (
    <button
      onClick={togglePictureInPicture}
      className={`px-3 py-2 rounded-lg font-bold transition-all duration-200 focus:outline-none focus:ring-2 ${
        isOpen
          ? 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-300 dark:focus:ring-red-900'
          : 'bg-green-500 hover:bg-green-600 text-white focus:ring-green-300 dark:focus:ring-green-900'
      } transform hover:scale-105 active:scale-95`}
      title={isOpen ? "Cerrar ventana PiP" : "Abrir ventana Picture-in-Picture"}
    >
      {isOpen ? <XIcon className="w-5 h-5" /> : <MaximizeIcon className="w-5 h-5" />}
    </button>
  );
}
