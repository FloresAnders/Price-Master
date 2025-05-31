'use client';
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { scanImageData } from '@undecaf/zbar-wasm';
import Quagga from '@ericblade/quagga2'; // ← Quagga 2

type Props = {
  onDetect?: (code: string) => void;
};

// Definimos el tipo mínimo que necesitamos de Quagga.ResultObject
interface QuaggaResultObject {
  codeResult?: {
    code: string;
  };
}

export default function BarcodeScanner({ onDetect }: Props) {
  // Estados principales
  const [code, setCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [detectionMethod, setDetectionMethod] = useState<string>('');
  const [cameraActive, setCameraActive] = useState<boolean>(false);

  // Refs para DOM
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const liveStreamRef = useRef<HTMLDivElement>(null);

  // Refs internos para manejar la captura iterativa con ZBar
  const zbarIntervalRef = useRef<number | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ------------------------------
  // 1. Copiar texto al portapapeles
  // ------------------------------
  const copyCodeToClipboard = async (codeText: string) => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
      return true;
    } catch {
      // Fallback navegadores antiguos
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

  // ------------------------------
  // 2. Limpiar estado
  // ------------------------------
  const clearState = () => {
    setCode('');
    setError('');
    setImagePreview('');
    setIsLoading(false);
    setCopySuccess(false);
    setDetectionMethod('');
  };

  // ----------------------------------------------------------------------------------
  // 3. Detección básica de patrones (fallback si ZBar y Quagga2 fallan)
  // ----------------------------------------------------------------------------------
  const detectBasicPattern = (imageData: ImageData): string | null => {
    const { data, width, height } = imageData;
    const toGrayscale = (r: number, g: number, b: number): number =>
      Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    const analyzeHorizontalLine = (
      y: number,
      threshold: number = 128
    ): { transitions: number; pattern: number[]; averageWidth: number } => {
      const pattern: number[] = [];
      let transitions = 0;
      let currentRunLength = 0;
      let lastPixelDark = false;

      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const gray = toGrayscale(data[idx], data[idx + 1], data[idx + 2]);
        const isDark = gray < threshold;
        if (x === 0) {
          lastPixelDark = isDark;
          currentRunLength = 1;
        } else if (isDark === lastPixelDark) {
          currentRunLength++;
        } else {
          pattern.push(currentRunLength);
          transitions++;
          lastPixelDark = isDark;
          currentRunLength = 1;
        }
      }
      if (currentRunLength > 0) {
        pattern.push(currentRunLength);
      }
      const averageWidth =
        pattern.length > 0
          ? pattern.reduce((a, b) => a + b, 0) / pattern.length
          : 0;
      return { transitions, pattern, averageWidth };
    };

    const analyzeMultipleLines = (
      numLines: number = 5
    ): { maxTransitions: number; bestPattern: number[]; consistency: number } => {
      const results: ReturnType<typeof analyzeHorizontalLine>[] = [];
      const startY = Math.floor(height * 0.3);
      const endY = Math.floor(height * 0.7);
      const step = Math.floor((endY - startY) / numLines);

      for (let i = 0; i < numLines; i++) {
        const y = startY + i * step;
        if (y < height) {
          results.push(analyzeHorizontalLine(y));
        }
      }

      const maxTransitions = Math.max(...results.map((r) => r.transitions));
      const bestResult =
        results.find((r) => r.transitions === maxTransitions) || results[0];

      const avgTransitions =
        results.reduce((sum, r) => sum + r.transitions, 0) / results.length;
      const variance =
        results.reduce(
          (sum, r) => sum + Math.pow(r.transitions - avgTransitions, 2),
          0
        ) / results.length;
      const consistency = Math.max(0, 1 - variance / (avgTransitions || 1));

      return {
        maxTransitions,
        bestPattern: bestResult.pattern,
        consistency,
      };
    };

    const detectBarcodePattern = (
      pattern: number[]
    ): { type: string | null; confidence: number } => {
      if (pattern.length < 10) return { type: null, confidence: 0 };
      const minWidth = Math.min(...pattern);
      const maxWidth = Math.max(...pattern);
      const avgWidth = pattern.reduce((a, b) => a + b, 0) / pattern.length;
      const ratio = maxWidth / (minWidth || 1);

      const isRegular = ratio < 4;
      const hasQuietZones =
        pattern[0] > avgWidth * 2 ||
        pattern[pattern.length - 1] > avgWidth * 2;

      let confidence = 0;
      let type: string | null = null;
      if (pattern.length >= 50 && pattern.length <= 100 && isRegular) {
        type = 'LINEAR_DENSE';
        confidence = 0.7;
      } else if (pattern.length >= 20 && pattern.length <= 50 && hasQuietZones) {
        type = 'LINEAR_STANDARD';
        confidence = 0.6;
      } else if (pattern.length >= 15 && ratio < 3) {
        type = 'LINEAR_SIMPLE';
        confidence = 0.4;
      }
      return { type, confidence };
    };

    const analysis = analyzeMultipleLines(7);
    const minTransitions = 15;
    const minConsistency = 0.3;
    if (
      analysis.maxTransitions >= minTransitions &&
      analysis.consistency >= minConsistency
    ) {
      const patternInfo = detectBarcodePattern(analysis.bestPattern);
      if (patternInfo.confidence > 0.3 && patternInfo.type) {
        const timestamp = Date.now().toString().slice(-6);
        const patternHash = analysis.bestPattern.slice(0, 4).join('');
        return `${patternInfo.type}_${patternHash}_${timestamp}`;
      }
    }
    return null;
  };

  const detectBasicPatternWithOrientation = (imageData: ImageData): string | null => {
    // Intenta horizontal
    const horizontalResult = detectBasicPattern(imageData);
    if (horizontalResult) return horizontalResult;

    // Rotar 90° para vertical
    const { data, width, height } = imageData;
    const rotatedData = new ImageData(height, width);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * 4;
        const dstIdx = (x * height + (height - 1 - y)) * 4;
        rotatedData.data[dstIdx] = data[srcIdx];
        rotatedData.data[dstIdx + 1] = data[srcIdx + 1];
        rotatedData.data[dstIdx + 2] = data[srcIdx + 2];
        rotatedData.data[dstIdx + 3] = data[srcIdx + 3];
      }
    }
    const verticalResult = detectBasicPattern(rotatedData);
    if (verticalResult) return `VERTICAL_${verticalResult}`;
    return null;
  };

  // ------------------------------------------------------
  // 4. preprocessImage: ajuste de contraste (opcional)
  // ------------------------------------------------------
  const preprocessImage = (imageData: ImageData): ImageData => {
    const { data, width, height } = imageData;
    const processedData = new ImageData(width, height);
    const histogram = new Array<number>(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      );
      histogram[gray]++;
    }

    const totalPixels = width * height;
    let cumulative = 0;
    let minVal = 0;
    let maxVal = 255;
    for (let i = 0; i < 256; i++) {
      cumulative += histogram[i];
      if (cumulative > totalPixels * 0.02 && minVal === 0) minVal = i;
      if (cumulative > totalPixels * 0.98 && maxVal === 255) {
        maxVal = i;
        break;
      }
    }

    const range = maxVal - minVal || 1;
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      );
      const adjusted = Math.max(0, Math.min(255, ((gray - minVal) * 255) / range));
      processedData.data[i] = adjusted;
      processedData.data[i + 1] = adjusted;
      processedData.data[i + 2] = adjusted;
      processedData.data[i + 3] = data[i + 3];
    }
    return processedData;
  };

  // ------------------------------------------------------------
  // 5. detectWithQuagga2: decodificación con Quagga 2 (imagen estática)
  // ------------------------------------------------------------
  const detectWithQuagga2 = async (imageData: ImageData): Promise<string | null> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      ctx.putImageData(imageData, 0, 0);

      Quagga.decodeSingle(
        {
          src: canvas.toDataURL('image/png'),
          numOfWorkers: 0,
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
          debug: {
            drawBoundingBox: false,
            showFrequency: false,
            drawScanline: false,
            showPattern: false,
          },
        },
        (result: QuaggaResultObject | null) => {
          if (result && result.codeResult && result.codeResult.code) {
            resolve(result.codeResult.code);
          } else {
            resolve(null);
          }
        }
      );
    });
  };

  // --------------------------------------------------------------------------------
  // 6. processImage: pipeline para imágenes (ZBar → Quagga 2 → Básica)
  // --------------------------------------------------------------------------------
  const processImage = useCallback(
    async (imageSrc: string) => {
      clearState();
      setIsLoading(true);
      setImagePreview(imageSrc);
      setError('');

      try {
        // 1) Extraer ImageData de la imagen cargada
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const imageLoaded = new Promise<HTMLImageElement>((resolve, reject) => {
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
          img.src = imageSrc;
        });
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

        // --------------------------------------------
        // MÉTODO 1: ZBar‑WASM sobre la imagen estática
        // --------------------------------------------
        try {
          const symbols = await scanImageData(imageData);
          if (symbols && symbols.length > 0) {
            detectedCode = symbols[0].decode();
            usedMethod = 'ZBar‑WASM';
          }
        } catch {
          // Si falla, seguimos
        }

        // --------------------------------------------
        // MÉTODO 2: Quagga 2 sobre la imagen estática
        // --------------------------------------------
        if (!detectedCode) {
          try {
            const quaggaResult = await detectWithQuagga2(imageData);
            if (quaggaResult) {
              detectedCode = quaggaResult;
              usedMethod = 'Quagga 2';
            }
          } catch {
            // Si falla, seguimos
          }
        }

        // --------------------------------------------
        // MÉTODO 3: Detección Básica (preprocesado + orientación)
        // --------------------------------------------
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

        // --------------------------------------------
        // Actualizar estados
        // --------------------------------------------
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
    [onDetect, detectBasicPatternWithOrientation]
  );

  // --------------------------------------------------------------------------------
  // 7. Iniciar Quagga 2 en modo cámara + bucle alternativo con ZBar (cada 500ms)
  // --------------------------------------------------------------------------------
  const startCameraScan = useCallback(() => {
    if (!liveStreamRef.current) {
      setError('No se encontró el contenedor de video para la cámara.');
      return;
    }

    // Inicializar Quagga 2 LiveStream, DESACTIVANDO debug drawing
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
          debug: {
            drawBoundingBox: false,
            showFrequency: false,
            drawScanline: false,
            showPattern: false,
          },
        },
        locate: true,
        numOfWorkers: navigator.hardwareConcurrency || 2,
        frequency: 5,
      },
      (err: unknown) => {
        if (err) {
          console.error('Error al inicializar Quagga 2 en cámara:', err);
          setError('No se pudo acceder a la cámara.');
          return;
        }
        Quagga.start();
      }
    );

    // Handler de Quagga 2 al detectar un código
    const onQuaggaDetected = (data: QuaggaResultObject) => {
      if (data.codeResult && data.codeResult.code) {
        const cameraCode = data.codeResult.code;

        // Detener todo (Quagga + ZBar interval)
        Quagga.stop();
        Quagga.offDetected(onQuaggaDetected);
        Quagga.offProcessed();
        if (zbarIntervalRef.current) {
          window.clearInterval(zbarIntervalRef.current);
          zbarIntervalRef.current = null;
        }
        setCameraActive(false);

        // Tomar snapshot del video actual
        if (liveStreamRef.current) {
          const videoElem = liveStreamRef.current.querySelector(
            'video'
          ) as HTMLVideoElement | null;
          if (videoElem) {
            const canvas = document.createElement('canvas');
            canvas.width = videoElem.videoWidth;
            canvas.height = videoElem.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
              const snapshot = canvas.toDataURL('image/png');
              setImagePreview(snapshot);
            }
          }
        }

        // Actualizar estado con el código detectado
        setCode(cameraCode);
        setDetectionMethod('Cámara (Quagga 2)');
        copyCodeToClipboard(cameraCode);
        if (onDetect) onDetect(cameraCode);
      }
    };

    Quagga.onDetected(onQuaggaDetected);

    // onProcessed sin resultado porque desactivamos debug drawing
    Quagga.onProcessed(() => {});

    // === Configurar un intervalo para ZBar‑WASM cada 500ms ===
    if (!hiddenCanvasRef.current) {
      hiddenCanvasRef.current = document.createElement('canvas');
    }
    zbarIntervalRef.current = window.setInterval(async () => {
      if (!liveStreamRef.current) return;
      const videoElem = liveStreamRef.current.querySelector(
        'video'
      ) as HTMLVideoElement | null;
      if (videoElem && videoElem.readyState === 4) {
        const vWidth = videoElem.videoWidth;
        const vHeight = videoElem.videoHeight;
        if (vWidth > 0 && vHeight > 0) {
          const canvas = hiddenCanvasRef.current!;
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

              // Detener Quagga y limpiar interval
              Quagga.stop();
              Quagga.offDetected(onQuaggaDetected);
              Quagga.offProcessed();
              if (zbarIntervalRef.current) {
                window.clearInterval(zbarIntervalRef.current);
                zbarIntervalRef.current = null;
              }
              setCameraActive(false);

              // Capturar el mismo frame como snapshot
              const canvas2 = document.createElement('canvas');
              canvas2.width = vWidth;
              canvas2.height = vHeight;
              const ctx2 = canvas2.getContext('2d');
              if (ctx2) {
                ctx2.drawImage(videoElem, 0, 0, vWidth, vHeight);
                const snapshot2 = canvas2.toDataURL('image/png');
                setImagePreview(snapshot2);
              }

              // Actualizar estado con el código detectado por ZBar
              setCode(zbarCode);
              setDetectionMethod('Cámara (ZBar‑WASM)');
              copyCodeToClipboard(zbarCode);
              if (onDetect) onDetect(zbarCode);
            }
          } catch {
            // Si scanImageData falla, solo ignoramos y esperamos al próximo intervalo
          }
        }
      }
    }, 500);
  }, [onDetect, detectBasicPatternWithOrientation]);

  const stopCameraScan = useCallback(() => {
    Quagga.stop();
    Quagga.offDetected();
    Quagga.offProcessed();
    if (zbarIntervalRef.current) {
      window.clearInterval(zbarIntervalRef.current);
      zbarIntervalRef.current = null;
    }
  }, []);

  // ----------------------------
  // 8. Toggle cámara
  // ----------------------------
  const toggleCamera = useCallback(() => {
    if (cameraActive) {
      stopCameraScan();
      setCameraActive(false);
    } else {
      clearState();
      setCameraActive(true);
    }
  }, [cameraActive, stopCameraScan]);

  // Cuando cameraActive cambia, iniciamos o detenemos Quagga & ZBar
  useEffect(() => {
    if (cameraActive) {
      startCameraScan();
    } else {
      stopCameraScan();
    }
    return () => {
      stopCameraScan();
    };
  }, [cameraActive, startCameraScan, stopCameraScan]);

  // ---------------------------------------------------------------------
  // 9. Event listeners para imágenes (paste, upload, drop)
  // ---------------------------------------------------------------------
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const imageSrc = e.target?.result as string;
              processImage(imageSrc);
            };
            reader.onerror = () => {
              setError('Error al leer la imagen pegada');
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [processImage]);

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

  // --------------------------
  // 10. Render del componente
  // --------------------------
  return (
    <div
      className="w-full max-w-5xl mx-auto flex flex-col gap-6 p-8 rounded-xl shadow-lg"
      style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
    >
      {/* Encabezado y botón toggle Cámara */}
      <div className="text-center flex flex-col items-center gap-2">
        <p className="text-sm text-gray-500">
          Pega una imagen (Ctrl+V), sube un archivo o usa la cámara
        </p>
        <button
          onClick={toggleCamera}
          className="px-4 py-2 rounded-md focus:outline-none focus:ring-2 text-white"
          style={{
            backgroundColor: cameraActive
              ? 'var(--button-hover)'
              : 'var(--button-bg)',
          }}
        >
          {cameraActive ? 'Detener Cámara' : 'Iniciar Cámara'}
        </button>
        <p className="text-xs text-gray-400">
          Métodos de detección (imagen): ZBar‑WASM → Quagga 2 → Detección Básica
        </p>
      </div>

      {/* Mensaje de “Código copiado” */}
      {copySuccess && (
        <div
          className="fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-bounce"
          style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--badge-text)' }}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium">¡Código copiado automáticamente!</span>
        </div>
      )}

      {/* Mostrar código detectado */}
      <div className="mb-4 text-center">
        <label className="block text-sm font-medium mx-auto text-center w-fit mb-2">
          Código detectado:
        </label>
        <div className="flex gap-2 justify-center">
          <input
            type="text"
            value={code}
            readOnly
            placeholder="Aquí aparecerá el código escaneado"
            className="flex-1 max-w-md px-3 py-2 text-center rounded-md focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--input-bg)',
              borderColor: 'var(--input-border)',
              borderWidth: '1px',
            }}
          />
          {code && (
            <button
              onClick={handleCopyCode}
              className="px-3 py-2 text-sm rounded-md focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--button-bg)',
                color: 'var(--button-text)',
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor = 'var(--button-hover)')
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.backgroundColor = 'var(--button-bg)')
              }
            >
              Copiar
            </button>
          )}
        </div>
        {detectionMethod && (
          <p className="text-xs text-gray-500 mt-2">
            Detectado usando:{' '}
            <span className="font-medium">{detectionMethod}</span>
          </p>
        )}
      </div>

      {/* Contenedor de cámara (solo si cameraActive===true) */}
      {cameraActive && (
        <div
          ref={liveStreamRef}
          className="w-full h-64 bg-black rounded-lg overflow-hidden mb-4"
          style={{ position: 'relative' }}
        >
          {/* Quagga 2 inyecta internamente un <video> en este <div> */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          />
        </div>
      )}

      {/* Área de carga de imagen (solo si cameraActive===false) */}
      {!cameraActive && (
        <div>
          <label className="block text-sm font-medium mx-auto text-center w-fit mb-2">
            Seleccionar imagen:
          </label>
          <div
            className="relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer"
            style={{ borderColor: 'var(--input-border)' }}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('bg-indigo-50');
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('bg-indigo-50');
            }}
            onDrop={(e) => {
              e.currentTarget.classList.remove('bg-indigo-50');
              handleDrop(e);
            }}
            onClick={handleDropAreaClick}
          >
            <div className="text-center pointer-events-none">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="mt-4">
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-indigo-600 hover:text-indigo-500">
                    Haz clic para seleccionar
                  </span>{' '}
                  o arrastra una imagen aquí
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  PNG, JPG, GIF hasta 10MB
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Botón “Limpiar Todo” */}
      {(code || error || imagePreview || cameraActive) && (
        <div className="flex justify-center">
          <button
            onClick={handleClear}
            className="px-6 py-2 text-sm rounded-md focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--button-bg)',
              color: 'var(--button-text)',
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.backgroundColor = 'var(--button-hover)')
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.backgroundColor = 'var(--button-bg)')
            }
          >
            Limpiar Todo
          </button>
        </div>
      )}

      {/* Spinner mientras procesa imagen (solo en modo imagen) */}
      {!cameraActive && isLoading && (
        <div
          className="text-center p-3 rounded"
          style={{
            backgroundColor: 'var(--input-bg)',
            color: 'var(--tab-text-active)',
          }}
        >
          <div
            className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 mr-2"
            style={{ borderColor: 'var(--tab-text-active)' }}
          />
          <p className="inline">Procesando imagen con múltiples métodos...</p>
        </div>
      )}

      {/* Mensaje de error (imagen o cámara) */}
      {error && (
        <div className="text-center text-red-600 bg-red-50 p-3 rounded">
          <p className="text-sm">{error}</p>
          <button
            onClick={handleClear}
            className="mt-2 text-xs bg-red-100 hover:bg-red-200 px-2 py-1 rounded"
          >
            Intentar de nuevo
          </button>
        </div>
      )}

      {/* Vista previa de la imagen estática cargada o snapshot de cámara */}
      {!cameraActive && imagePreview && (
        <div className="border rounded-lg overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imagePreview}
            alt="Preview"
            className="w-full max-h-48 object-contain"
            style={{ backgroundColor: 'var(--input-bg)' }}
          />
        </div>
      )}

      {/* Mensaje de éxito de detección (solo modo imagen) */}
      {!cameraActive && code && !isLoading && (
        <div
          className="text-center p-3 rounded"
          style={{
            backgroundColor: 'var(--badge-bg)',
            color: 'var(--badge-text)',
          }}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm font-medium">
              ¡Código detectado y copiado exitosamente!
            </p>
          </div>
          <p className="text-xs">
            Código:{' '}
            <span className="font-mono bg-white px-1 rounded">{code}</span>
          </p>
          <p className="text-xs mt-1">
            Método:{' '}
            <span className="font-medium">{detectionMethod}</span>
          </p>
          <p className="text-xs mt-1 text-green-500">
            ✓ Copiado al portapapeles automáticamente
          </p>
        </div>
      )}
    </div>
  );
}
