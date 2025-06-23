import { useState, useRef, useCallback, useEffect } from 'react';
import { scanImageData } from '@undecaf/zbar-wasm';
import { detectBasicPatternWithOrientation, preprocessImage, detectWithQuagga2 } from '../utils/barcodeUtils';
import ZBAR_PRIORITY_CONFIG, { logZbarPriority } from '../config/zbar-priority';

export function useBarcodeScanner(onDetect?: (code: string, productName?: string) => void) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [detectionMethod, setDetectionMethod] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const liveStreamRef = useRef<HTMLDivElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Copiar código al portapapeles
  const copyCodeToClipboard = async (codeText: string) => {
    try {
      // Check if modern clipboard API is available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(codeText);
      } else {
        // Fallback for older browsers or insecure contexts
        const textArea = document.createElement('textarea');
        textArea.value = codeText;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
      return true;
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      // Fallback para navegadores antiguos
      try {
        const textArea = document.createElement('textarea');
        textArea.value = codeText;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 3000);
        return true;
      } catch {
        return false;
      }
    }
  };

  // Limpiar estado
  const clearState = () => {
    setCode('');
    setError('');
    setImagePreview('');
    setIsLoading(false);
    setCopySuccess(false);
    setDetectionMethod('');
  };
  // Procesar imagen (pipeline: ZBar → Quagga2 → Básica) - OPTIMIZADO PARA VELOCIDAD
  const processImage = useCallback(
    async (imageSrc: string) => {
      clearState();
      setIsLoading(true);
      setImagePreview(imageSrc);
      setError('');

      // Usar requestAnimationFrame para procesamiento inmediato sin bloquear UI
      await new Promise(resolve => requestAnimationFrame(resolve));

      try {
        // 1) Extraer ImageData de la imagen cargada - OPTIMIZADO
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        const imageLoaded = new Promise<HTMLImageElement>((resolve, reject) => {
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
        });
        img.src = imageSrc;
        const loadedImg = await imageLoaded;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No se pudo obtener contexto de canvas');
        canvas.width = loadedImg.naturalWidth;
        canvas.height = loadedImg.naturalHeight;
        ctx.drawImage(loadedImg, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        let detectedCode = '';
        let usedMethod = '';

        // 1. ZBar‑WASM (MÁXIMA PRIORIDAD - siempre se intenta PRIMERO)
        logZbarPriority('ZBAR_START', 'Procesando imagen con ZBar-WASM');
        try {
          const symbols = await scanImageData(imageData);
          if (symbols && symbols.length > 0) {
            const code = symbols[0].decode();
            if (code &&
              ZBAR_PRIORITY_CONFIG.VALID_CODE_PATTERN.test(code) &&
              code.length >= ZBAR_PRIORITY_CONFIG.MIN_CODE_LENGTH &&
              code.length <= ZBAR_PRIORITY_CONFIG.MAX_CODE_LENGTH) {
              detectedCode = code;
              usedMethod = 'ZBar‑WASM (PRIORIDAD MÁXIMA)';
              logZbarPriority('ZBAR_SUCCESS', 'ZBar-WASM detectó código', code);
            }
          }
        } catch {
          logZbarPriority('ZBAR_PROCESSING', 'ZBar-WASM procesando, continuando con fallback');
        }

        // 2. Quagga2 (SOLO si ZBar-WASM no detectó nada)
        if (!detectedCode) {
          logZbarPriority('QUAGGA_FALLBACK', 'ZBar-WASM no detectó código, iniciando fallback con Quagga2');
          try {
            // Usar el retraso configurado para dar prioridad absoluta a ZBar-WASM
            const quaggaResult = await detectWithQuagga2(imageData, ZBAR_PRIORITY_CONFIG.QUAGGA_FALLBACK_DELAY);
            if (quaggaResult) {
              detectedCode = quaggaResult;
              usedMethod = 'Quagga 2 (Fallback)';
              logZbarPriority('QUAGGA_SUCCESS', 'Quagga2 detectó código como fallback', quaggaResult);
            }
          } catch {
            logZbarPriority('ZBAR_PROCESSING', 'Error en Quagga2 fallback, continuando...');
          }
        } else {
          logZbarPriority('QUAGGA_IGNORED', 'Quagga2 no ejecutado - ZBar-WASM ya detectó código');
        }

        // 3. Básica (preprocesada y sin preprocesar)
        if (!detectedCode) {
          const preprocessedData = preprocessImage(imageData);
          const basicResult = detectBasicPatternWithOrientation(preprocessedData);
          if (basicResult) {
            detectedCode = basicResult;
            usedMethod = 'Detección Básica (preprocesada)';
          } else {
            const fallbackResult = detectBasicPatternWithOrientation(imageData);
            if (fallbackResult) {
              detectedCode = fallbackResult;
              usedMethod = 'Detección Básica (sin preprocesar)';
            }
          }
        }
        // Actualizar estados
        if (detectedCode) {
          setCode(detectedCode);
          setDetectionMethod(usedMethod);
          const copied = await copyCodeToClipboard(detectedCode);
          if (!copied) {
            console.warn('No se pudo copiar al portapapeles automáticamente');
          }
          if (onDetect) onDetect(detectedCode);
        } else {
          setError('No se detectó ningún código de barras en la imagen.');
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Error desconocido al procesar la imagen.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [onDetect]
  );
  // Handlers para input file, drop, click área - OPTIMIZADO PARA ANÁLISIS INMEDIATO
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageSrc = e.target?.result as string;
        // Procesamiento inmediato sin setTimeout
        processImage(imageSrc);
      };
      reader.onerror = () => {
        setError('Error al leer el archivo de imagen');
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    } else {
      setError('Por favor selecciona un archivo de imagen válido');
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageSrc = e.target?.result as string;
        // Procesamiento inmediato sin setTimeout
        processImage(imageSrc);
      };
      reader.onerror = () => {
        setError('Error al leer el archivo arrastrado');
      };
      reader.readAsDataURL(file);
    } else {
      setError('Por favor arrastra un archivo de imagen válido');
    }
  };

  const handleDropAreaClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      fileInputRef.current?.click();
    }
  };

  const handleClear = () => {
    clearState();
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraActive) {
      setCameraActive(false);
    }
  };

  const handleCopyCode = async () => {
    if (code) {
      const success = await copyCodeToClipboard(code);
      if (!success) setError('No se pudo copiar el código al portapapeles');
    }
  };

  // Toggle cámara: siempre alternar cameraActive para iniciar lógica en useEffect
  const toggleCamera = useCallback(() => {
    setError('');
    setCameraActive((prev) => !prev);
  }, []);
  // --- Cámara: iniciar/detener Quagga2 LiveStream - OPTIMIZADO PARA ANÁLISIS INMEDIATO ---
  useEffect(() => {
    let lastZbarCode = '';
    let lastQuaggaCode = '';
    const cleanupRef: HTMLDivElement | null = liveStreamRef.current;
    async function startCamera() {
      try {
        const Quagga = (await import('@ericblade/quagga2')).default;
        if (!liveStreamRef.current) {
          setError('No se encontró el contenedor de video para la cámara.');
          setCameraActive(false);
          return;
        }
        Quagga.init(
          {
            inputStream: {
              type: 'LiveStream',
              constraints: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              target: liveStreamRef.current,
            },
            decoder: {
              readers: [
                'code_128_reader',
                'ean_reader',
                'ean_8_reader',
                'code_39_reader',
                'codabar_reader',
                'upc_reader',
                'i2of5_reader',
                'code_93_reader',
              ],
              debug: {
                drawBoundingBox: true,
                showFrequency: true,
                drawScanline: true,
                showPattern: true,
              },
              multiple: false,
            },
            locate: true,
            numOfWorkers: 2,
            frequency: 10,
          },
          (err: unknown) => {
            if (err) {
              setError('No se pudo acceder a la cámara.');
              setCameraActive(false);
              return;
            }
            Quagga.start();
            // Apply CSS classes to the video element so it fully fills the container
            const videoElem = liveStreamRef.current?.querySelector('video');
            if (videoElem) {
              videoElem.classList.add('absolute', 'inset-0', 'w-full', 'h-full', 'object-cover');
              videoElem.setAttribute('playsinline', 'true');
            }
          }
        );        // --- ZBar-WASM con requestAnimationFrame para MÁXIMA VELOCIDAD Y PRIORIDAD ---
        const scanFrame = async () => {
          if (!liveStreamRef.current || !cameraActive) return;
          const videoElem = liveStreamRef.current.querySelector('video') as HTMLVideoElement | null;
          if (videoElem && videoElem.readyState === 4) {
            const vWidth = videoElem.videoWidth;
            const vHeight = videoElem.videoHeight;
            if (vWidth > 0 && vHeight > 0) {
              const canvas = document.createElement('canvas');
              canvas.width = vWidth;
              canvas.height = vHeight;
              const ctx = canvas.getContext('2d');
              if (!ctx) return;
              ctx.drawImage(videoElem, 0, 0, vWidth, vHeight);
              const frameData = ctx.getImageData(0, 0, vWidth, vHeight);
              try {
                logZbarPriority('ZBAR_START', 'Escaneando frame con ZBar-WASM');
                // PRIMERO ZBAR con validación mejorada
                const symbols = await scanImageData(frameData);
                if (symbols && symbols.length > 0) {
                  const zbarCode = symbols[0].decode();
                  if (zbarCode &&
                    zbarCode !== lastZbarCode &&
                    ZBAR_PRIORITY_CONFIG.VALID_CODE_PATTERN.test(zbarCode) &&
                    zbarCode.length >= ZBAR_PRIORITY_CONFIG.MIN_CODE_LENGTH &&
                    zbarCode.length <= ZBAR_PRIORITY_CONFIG.MAX_CODE_LENGTH) {
                    lastZbarCode = zbarCode;
                    setCode(zbarCode);
                    setDetectionMethod('Cámara (ZBar‑WASM PRIORIDAD MÁXIMA)');
                    logZbarPriority('ZBAR_SUCCESS', 'ZBar-WASM detectó código en cámara', zbarCode);
                    copyCodeToClipboard(zbarCode);
                    if (onDetect) onDetect(zbarCode);
                    Quagga.stop();
                    setCameraActive(false);
                    return;
                  }
                }
                // SOLO SI ZBAR NO DETECTA, USAR QUAGGA
                // (NO hacer nada aquí, Quagga.onDetected solo se ejecuta si ZBar no detecta nada)
              } catch {
                logZbarPriority('ZBAR_PROCESSING', 'ZBar-WASM procesando frame...');
              }
            }
          }

          // Continuar escaneando con requestAnimationFrame para máximo rendimiento
          if (cameraActive) {
            requestAnimationFrame(scanFrame);
          }
        };

        // Iniciar el escaneo continuo
        requestAnimationFrame(scanFrame);// Quagga2 detection SOLO SI ZBar no detecta (con configuración mejorada)
        Quagga.offDetected(); // Elimina cualquier listener anterior para evitar duplicados
        Quagga.onDetected((data: { codeResult?: { code: string | null } }) => {
          if (lastZbarCode) {
            logZbarPriority('QUAGGA_IGNORED', 'Quagga2 ignorado - ZBar-WASM ya detectó código');
            return; // Si ZBar ya detectó, ignorar Quagga
          }
          const code = data.codeResult?.code;
          // Usar validación de la configuración de prioridad
          const valid = typeof code === 'string' &&
            ZBAR_PRIORITY_CONFIG.VALID_CODE_PATTERN.test(code) &&
            code.length >= ZBAR_PRIORITY_CONFIG.MIN_CODE_LENGTH &&
            code.length <= ZBAR_PRIORITY_CONFIG.MAX_CODE_LENGTH; if (valid && code !== lastQuaggaCode) {
              lastQuaggaCode = code;
              setCode(code);
              setDetectionMethod('Cámara (Quagga2 Fallback)');
              logZbarPriority('QUAGGA_SUCCESS', 'Quagga2 detectó código como fallback en cámara', code); copyCodeToClipboard(code);
              if (onDetect) onDetect(code);
              Quagga.stop();
              setCameraActive(false);
            }
        });
      } catch {
        setError('Error al iniciar la cámara.');
        setCameraActive(false);
      }
    }
    if (cameraActive) {
      startCamera();
    } else {
      (async () => {
        try {
          const Quagga = (await import('@ericblade/quagga2')).default;
          Quagga.stop();
        } catch { }
        if (cleanupRef) {
          while (cleanupRef.firstChild) cleanupRef.removeChild(cleanupRef.firstChild);
        }
      })();
    }
    return () => {
      (async () => {
        try {
          const Quagga = (await import('@ericblade/quagga2')).default;
          Quagga.stop();
        } catch { }
        if (cleanupRef) {
          while (cleanupRef.firstChild) cleanupRef.removeChild(cleanupRef.firstChild);
        }
      })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraActive]);

  return {
    code,
    isLoading,
    error,
    imagePreview,
    copySuccess,
    detectionMethod,
    cameraActive,
    setCameraActive,
    setCode, setError,
    setImagePreview,
    setCopySuccess,
    setDetectionMethod,
    imgRef,
    fileInputRef,
    liveStreamRef,
    hiddenCanvasRef,
    handleFileUpload,
    handleDrop,
    handleDropAreaClick,
    handleClear,
    handleCopyCode,
    toggleCamera,
    processImage,
  };
}
