'use client';
import React, { useState, useRef, useEffect } from 'react';
import { scanImageData } from '@undecaf/zbar-wasm';

type Props = { onDetect?: (code: string) => void };

export default function BarcodeScanner({ onDetect }: Props) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Función para copiar código al portapapeles
  const copyCodeToClipboard = async (codeText: string) => {
    try {
      await navigator.clipboard.writeText(codeText);
      console.log('Código copiado automáticamente al portapapeles:', codeText);
      setCopySuccess(true);
      
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
    setCopySuccess(false);
  };

  // Función para procesar la imagen y detectar código de barras con zbar-wasm
  const processImage = async (imageSrc: string) => {
    console.log('Iniciando procesamiento de imagen con zbar-wasm...');
    
    // Limpiar estado anterior
    clearState();
    setIsLoading(true);
    setImagePreview(imageSrc);
    
    try {
      // Crear canvas para procesar la imagen
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('No se pudo crear el contexto del canvas');
      }

      // Crear una nueva imagen para procesar
      const img = new Image();
      
      const imageLoaded = new Promise<HTMLImageElement>((resolve, reject) => {
        img.onload = () => {
          console.log('Imagen cargada correctamente:', img.width, 'x', img.height);
          resolve(img);
        };
        img.onerror = (err) => {
          console.error('Error al cargar imagen:', err);
          reject(new Error('No se pudo cargar la imagen'));
        };
        img.crossOrigin = 'anonymous'; // Para evitar problemas de CORS
        img.src = imageSrc;
      });

      const loadedImg = await imageLoaded;
      
      // Configurar canvas con las dimensiones de la imagen
      canvas.width = loadedImg.naturalWidth;
      canvas.height = loadedImg.naturalHeight;
      
      // Dibujar la imagen en el canvas
      context.drawImage(loadedImg, 0, 0);
      
      // Obtener ImageData del canvas
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // Asignar la imagen al ref para mostrarla
      if (imgRef.current) {
        imgRef.current.src = imageSrc;
      }

      console.log('Intentando decodificar código de barras con zbar-wasm...');
      
      // Usar zbar-wasm para escanear la imagen
      const symbols = await scanImageData(imageData);
      
      if (symbols && symbols.length > 0) {
        // Tomar el primer símbolo encontrado
        const firstSymbol = symbols[0];
        const detectedCode = firstSymbol.decode();
        
        console.log('Código detectado:', detectedCode);
        console.log('Tipo de código:', firstSymbol.typeName);
        
        setCode(detectedCode);
        
        // Copiar automáticamente al portapapeles
        await copyCodeToClipboard(detectedCode);
        
        // Llamar callback si existe
        if (onDetect) {
          onDetect(detectedCode);
        }
        setError(''); // Limpiar cualquier error anterior
      } else {
        throw new Error('No se detectaron códigos de barras en la imagen');
      }
      
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

  // Configurar event listeners
  useEffect(() => {
    const handlePasteEvent = (e: ClipboardEvent) => handlePaste(e);
    
    window.addEventListener('paste', handlePasteEvent);
    
    return () => {
      window.removeEventListener('paste', handlePasteEvent);
    };
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 p-8 rounded-xl shadow-lg" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}>
      <div className="text-center">
        <p className="text-sm text-gray-500">Pega una imagen (Ctrl+V) o sube un archivo</p>
      </div>

      {copySuccess && (
        <div className="fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-bounce"
             style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--badge-text)' }}>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">¡Código copiado automáticamente!</span>
        </div>
      )}

      <div className="mb-4 tex-align-center">
        <label className="block text-sm font-medium mx-auto text-center w-fit mb-5">Código detectado:</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            readOnly
            placeholder="Aquí aparecerá el código escaneado"
            className="flex-1 px-3 py-2 rounded-md focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--input-bg)',
              borderColor: 'var(--input-border)',
              borderWidth: '1px'
            }}
          />
          {code && (
            <button
              onClick={handleCopyCode}
              className="px-3 py-2 text-sm rounded-md focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--button-bg)',
                color: 'var(--button-text)'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--button-hover)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--button-bg)'}
            >
              Copiar
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mx-auto text-center w-fit mb-5">Seleccionar imagen:</label>
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
            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                <span className="font-medium text-indigo-600 hover:text-indigo-500">Haz clic para seleccionar</span> o arrastra una imagen aquí
              </p>
              <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF hasta 10MB</p>
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

      {(code || error || imagePreview) && (
        <div className="flex justify-center">
          <button
            onClick={handleClear}
            className="px-6 py-2 text-sm rounded-md focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--button-bg)',
              color: 'var(--button-text)'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--button-hover)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--button-bg)'}
          >
            Limpiar Todo
          </button>
        </div>
      )}

      {isLoading && (
        <div className="text-center p-3 rounded" style={{ backgroundColor: 'var(--input-bg)', color: 'var(--tab-text-active)' }}>
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 mr-2" style={{ borderColor: 'var(--tab-text-active)' }}></div>
          <p className="inline">Procesando imagen con zbar-wasm...</p>
        </div>
      )}

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

      {imagePreview && (
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

      {code && !isLoading && (
        <div className="text-center p-3 rounded" style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--badge-text)' }}>
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
