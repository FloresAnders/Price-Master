// Configuración optimizada para ZBar-WASM con máxima prioridad
// Este archivo asegura que ZBar-WASM tenga la máxima prioridad en la detección
// Con multi-intento: ZBar se prueba en raw, sharpened, contrast, binarized

export const ZBAR_PRIORITY_CONFIG = {
  // Configuración principal - ZBar-WASM SIEMPRE primero
  ZBAR_SCAN_INTERVAL: 150, // ms - más frecuente para máxima prioridad en cámara
  // Los intentos múltiples de ZBar reemplazan la necesidad del delay de Quagga
  ZBAR_RETRY_VARIANTS: ['raw', 'sharpened', 'contrast', 'binarized'] as const,

  // Configuración de validación
  MIN_CODE_LENGTH: 8,
  MAX_CODE_LENGTH: 20,
  VALID_CODE_PATTERN: /^[0-9A-Za-z\-\+\.\$\/\%]+$/,

  // Configuración de logs para confirmación visual
  ENABLE_PRIORITY_LOGS: true,

  // Mensajes de log
  LOGS: {
    ZBAR_START: "🔍 [PRIORIDAD MÁXIMA] ZBar-WASM iniciando...",
    ZBAR_SUCCESS: "✅ [ÉXITO ZBAR] Código detectado",
    ZBAR_PROCESSING: "⚠️ [ZBAR] Procesando frame...",
    ZBAR_RETRY_SHARPEN: "🔍 [INTENTO 2/4] ZBar en imagen realzada (sharpened)...",
    ZBAR_RETRY_CONTRAST: "🔍 [INTENTO 3/4] ZBar en contraste mejorado...",
    ZBAR_RETRY_BINARIZED: "🔍 [INTENTO 4/4] ZBar en imagen binarizada (Otsu)...",
    QUAGGA_FALLBACK: "🔄 [FALLBACK] Configurando Quagga2 como respaldo...",
    QUAGGA_SUCCESS: "⚠️ [QUAGGA] Código detectado como fallback",
    QUAGGA_IGNORED: "🚫 [IGNORADO] Quagga2 ignorado - ZBar ya detectó",
  },
};

export const logZbarPriority = (
  type: string,
  message: string,
  data?: unknown,
) => {
  if (ZBAR_PRIORITY_CONFIG.ENABLE_PRIORITY_LOGS) {
    const logMessage =
      ZBAR_PRIORITY_CONFIG.LOGS[
        type as keyof typeof ZBAR_PRIORITY_CONFIG.LOGS
      ] || message;
  }
};

export default ZBAR_PRIORITY_CONFIG;
