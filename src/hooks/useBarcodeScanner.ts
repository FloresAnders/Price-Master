import { useState, useRef, useCallback } from 'react';
import { scanImageData } from '@undecaf/zbar-wasm';
import Quagga from '@ericblade/quagga2';
import { detectBasicPatternWithOrientation, preprocessImage, detectWithQuagga2 } from '../utils/barcodeUtils';
import type { QuaggaResultObject } from '../types/barcode';

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
