'use client';
import React, { useState, useRef, useEffect } from 'react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';

type Props = { onDetect?: (code: string) => void };

export default function BarcodeScanner({ onDetect }: Props) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [copySuccess, setCopySuccess] = useState(false); // NUEVO: Estado para mostrar éxito de copia
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // Inicializar el lector con configuración
  useEffect(() => {
    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        // Códigos 1D existentes
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,        // Nuevo
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93,      // Nuevo
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,        // Nuevo
        BarcodeFormat.ITF,
        BarcodeFormat.CODABAR,
        BarcodeFormat.RSS_14,       // Nuevo
        BarcodeFormat.RSS_EXPANDED, // Nuevo

      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      codeReaderRef.current = new BrowserMultiFormatReader(hints);
      console.log('BarcodeReader inicializado correctamente');
    } catch (err) {
      console.error('Error al inicializar BarcodeReader:', err);
      setError('Error al inicializar el escáner de códigos de barras');
    }
  }, []);
  // NUEVA FUNCIÓN: Copiar código automáticamente
  const copyCodeToClipboard = async (codeText: string) => {
    try {
      await navigator.clipboard.writeText(codeText);
      console.log('Código copiado automáticamente al portapapeles:', codeText);
      setCopySuccess(true);

      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => {
        setCopySuccess(false);
      }, 3000);

      return true;
    } catch (err) {
      console.error('Error al copiar automáticamente:', err);
      // Fallback para navegadores que no soportan clipboard API
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
        setTimeout(() => {
          setCopySuccess(false);
        }, 3000);

        return true;
      } catch (fallbackErr) {
        console.error('Error en fallback de copia:', fallbackErr);
        return false;
      }
    }
  };

  // Función para limpiar el estado
  const clearState = () => {
    setCode('');
    setError('');
    setImagePreview('');
    setIsLoading(false);
    setCopySuccess(false); // NUEVO: Limpiar estado de copia
  };

  // Función para procesar la imagen y detectar código de barras
  const processImage = async (imageSrc: string) => {
    console.log('Iniciando procesamiento de imagen...');

    if (!codeReaderRef.current) {
      console.error('CodeReader no está inicializado');
      setError('El escáner no está inicializado correctamente');
      return;
    }

    // Limpiar estado anterior
    clearState();
    setIsLoading(true);
    setImagePreview(imageSrc);

    try {
      // Crear una nueva imagen para procesar
      const img = new Image();

      // Promesa para cargar la imagen
      const imageLoaded = new Promise<HTMLImageElement>((resolve, reject) => {
        img.onload = () => {
          console.log('Imagen cargada correctamente:', img.width, 'x', img.height);
          resolve(img);
        };
        img.onerror = (err) => {
          console.error('Error al cargar imagen:', err);
          reject(new Error('No se pudo cargar la imagen'));
        };
        img.src = imageSrc;
      });

      const loadedImg = await imageLoaded;

      // Asignar la imagen al ref también para mostrarla
      if (imgRef.current) {
        imgRef.current.src = imageSrc;
      }

      // Pequeña pausa para asegurar que todo esté listo
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log('Intentando decodificar código de barras...');

      // Intentar decodificar el código de barras usando la imagen cargada
      const result = await codeReaderRef.current.decodeFromImageElement(loadedImg);
      const detectedCode = result.getText();

      console.log('Código detectado:', detectedCode);

      setCode(detectedCode);

      // NUEVO: Copiar automáticamente al portapapeles
      await copyCodeToClipboard(detectedCode);

      // Llamar callback si existe
      if (onDetect) {
        onDetect(detectedCode);
      }
      setError(''); // Limpiar cualquier error anterior

    } catch (err) {
      console.error('Error al procesar imagen:', err);
      setError('No se pudo detectar un código de barras en la imagen. Asegúrate de que la imagen contenga un código de barras visible y bien iluminado.');
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar pegado de imagen desde portapapeles
  const handlePaste = async (event: ClipboardEvent) => {
    console.log('Detectado evento de pegado');
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log('Item tipo:', item.type);

      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) {
          console.log('Procesando imagen pegada:', file.name, file.type);
          const reader = new FileReader();
          reader.onload = (e) => {
            const imageSrc = e.target?.result as string;
            processImage(imageSrc);
          };
          reader.onerror = (e) => {
            console.error('Error al leer archivo:', e);
            setError('Error al leer la imagen pegada');
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  // Manejar carga de archivo
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log('Archivo seleccionado:', file?.name, file?.type);

    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageSrc = e.target?.result as string;
        console.log('Archivo leído, procesando imagen...');
        processImage(imageSrc);
      };
      reader.onerror = (e) => {
        console.error('Error al leer archivo:', e);
        setError('Error al leer el archivo de imagen');
      };
      reader.readAsDataURL(file);

      // Limpiar el input para permitir seleccionar la misma imagen de nuevo
      event.target.value = '';
    } else {
      setError('Por favor selecciona un archivo de imagen válido');
    }
  };

  // Manejar drag and drop
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    console.log('Archivo arrastrado:', file?.name, file?.type);

    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageSrc = e.target?.result as string;
        processImage(imageSrc);
      };
      reader.onerror = (e) => {
        console.error('Error al leer archivo arrastrado:', e);
        setError('Error al leer el archivo arrastrado');
      };
      reader.readAsDataURL(file);
    } else {
      setError('Por favor arrastra un archivo de imagen válido');
    }
  };

  // Función para limpiar todo y permitir nuevo escaneo
  const handleClear = () => {
    clearState();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    console.log('Estado limpiado');
  };

  // Copiar código al portapapeles manualmente
  const handleCopyCode = async () => {
    if (code) {
      const success = await copyCodeToClipboard(code);
      if (!success) {
        setError('No se pudo copiar el código al portapapeles');
      }
    }
  };

  // Manejar click en el área de drop
  const handleDropAreaClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      fileInputRef.current?.click();
    }
  };

  // Limpiar recursos al desmontar
  useEffect(() => {
    const handlePasteEvent = (e: ClipboardEvent) => handlePaste(e);

    window.addEventListener('paste', handlePasteEvent);

    return () => {
      window.removeEventListener('paste', handlePasteEvent);
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-lg shadow-md">
      <div className="text-center">
        <p className="text-sm text-gray-500">
          Pega una imagen (Ctrl+V) o sube un archivo
        </p>
      </div>

      {/* NUEVO: Notificación de copia automática */}
      {copySuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-bounce">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">¡Código copiado automáticamente!</span>
        </div>
      )}

      {/* Input para mostrar el código detectado */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Código detectado:
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            readOnly
            placeholder="Aquí aparecerá el código escaneado"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {code && (
            <button
              onClick={handleCopyCode}
              className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Copiar
            </button>
          )}
        </div>
      </div>

      {/* Área de carga de imagen */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Seleccionar imagen:
        </label>

        {/* Zona de drag and drop */}
        <div
          className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-indigo-400 transition-colors cursor-pointer"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add('border-indigo-400', 'bg-indigo-50');
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50');
          }}
          onDrop={(e) => {
            e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50');
            handleDrop(e);
          }}
          onClick={handleDropAreaClick}
        >
          <div className="text-center pointer-events-none">
            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                <span className="font-medium text-indigo-600 hover:text-indigo-500">
                  Haz clic para seleccionar
                </span>
                {' '}o arrastra una imagen aquí
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

      {/* Botón de limpiar */}
      {(code || error || imagePreview) && (
        <div className="flex justify-center">
          <button
            onClick={handleClear}
            className="px-6 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Limpiar Todo
          </button>
        </div>
      )}

      {/* Indicador de carga */}
      {isLoading && (
        <div className="text-center text-indigo-600 bg-indigo-50 p-3 rounded">
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></div>
          <p className="inline">Procesando imagen...</p>
        </div>
      )}

      {/* Mensaje de error */}
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

      {/* Preview de la imagen */}
      {imagePreview && (
        <div className="border rounded-lg overflow-hidden">
          <img
            ref={imgRef}
            src={imagePreview}
            alt="Preview"
            className="w-full max-h-48 object-contain bg-gray-50"
          />
        </div>
      )}

      {/* Mensaje de éxito - MODIFICADO */}
      {code && !isLoading && (
        <div className="text-center text-green-600 bg-green-50 p-3 rounded">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <p className="text-sm font-medium">¡Código detectado y copiado exitosamente!</p>
          </div>
          <p className="text-xs">Código: <span className="font-mono bg-white px-1 rounded">{code}</span></p>
          <p className="text-xs mt-1 text-green-500">✓ Copiado al portapapeles automáticamente</p>
        </div>
      )}
    </div>
  );
}