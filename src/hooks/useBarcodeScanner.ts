import { useState, useRef, useCallback, useEffect } from 'react';
import { scanImageData } from '@undecaf/zbar-wasm';
import { detectBasicPatternWithOrientation, preprocessImage, detectWithQuagga2 } from '../utils/barcodeUtils';

export function useBarcodeScanner(onDetect?: (code: string) => void) {
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
  const zbarIntervalRef = useRef<number | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Copiar código al portapapeles
  const copyCodeToClipboard = async (codeText: string) => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
      return true;
    } catch {
      // Fallback para navegadores antiguos
      try {
        const textArea = document.createElement('textarea');
        textArea.value = codeText;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
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

  // Procesar imagen (pipeline: ZBar → Quagga2 → Básica)
  const processImage = useCallback(
    async (imageSrc: string) => {
      clearState();
      setIsLoading(true);
      setImagePreview(imageSrc);
      setError('');
      try {
        // 1) Extraer ImageData de la imagen cargada
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
        // 1. ZBar‑WASM
        try {
          const symbols = await scanImageData(imageData);
          if (symbols && symbols.length > 0) {
            detectedCode = symbols[0].decode();
            usedMethod = 'ZBar‑WASM';
          }
        } catch {}
        // 2. Quagga2
        if (!detectedCode) {
          try {
            const quaggaResult = await detectWithQuagga2(imageData);
            if (quaggaResult) {
              detectedCode = quaggaResult;
              usedMethod = 'Quagga 2';
            }
          } catch {}
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

  // Handlers para input file, drop, click área
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageSrc = e.target?.result as string;
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

  // Toggle cámara (solo stub, lógica de cámara debe migrarse si se usa)
  const toggleCamera = useCallback(() => {
    setCameraActive((prev) => !prev);
  }, []);

  // --- Cámara: iniciar/detener Quagga2 LiveStream ---
  useEffect(() => {
    let zbarInterval: number | null = null;
    let lastZbarCode = '';
    let lastQuaggaCode = '';
    let cleanupRef: HTMLDivElement | null = liveStreamRef.current;
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
            },
            locate: true,
            numOfWorkers: 1,
            frequency: 5,
          },
          (err: unknown) => {
            if (err) {
              setError('No se pudo acceder a la cámara.');
              setCameraActive(false);
              return;
            }
            Quagga.start();
          }
        );
        // Quagga2 detection
        Quagga.onDetected((data: { codeResult?: { code: string | null } }) => {
          if (data.codeResult && data.codeResult.code && data.codeResult.code !== lastQuaggaCode) {
            lastQuaggaCode = data.codeResult.code;
            setCode(data.codeResult.code);
            setDetectionMethod('Cámara (Quagga2)');
            copyCodeToClipboard(data.codeResult.code);
            if (onDetect) onDetect(data.codeResult.code);
            Quagga.stop();
            setCameraActive(false);
            if (zbarInterval) window.clearInterval(zbarInterval);
          }
        });
        // ZBar-WASM cada 500ms
        zbarInterval = window.setInterval(async () => {
          if (!liveStreamRef.current) return;
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
                const symbols = await scanImageData(frameData);
                if (symbols && symbols.length > 0) {
                  const zbarCode = symbols[0].decode();
                  if (zbarCode && zbarCode !== lastZbarCode) {
                    lastZbarCode = zbarCode;
                    setCode(zbarCode);
                    setDetectionMethod('Cámara (ZBar‑WASM)');
                    copyCodeToClipboard(zbarCode);
                    if (onDetect) onDetect(zbarCode);
                    Quagga.stop();
                    setCameraActive(false);
                    if (zbarInterval) window.clearInterval(zbarInterval);
                  }
                }
              } catch {}
            }
          }
        }, 500);
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
        } catch {}
        if (zbarInterval) window.clearInterval(zbarInterval);
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
        } catch {}
        if (zbarInterval) window.clearInterval(zbarInterval);
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
    setCode,
    setError,
    setImagePreview,
    setCopySuccess,
    setDetectionMethod,
    imgRef,
    fileInputRef,
    liveStreamRef,
    zbarIntervalRef,
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
