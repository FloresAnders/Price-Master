// Configuración optimizada para ZBar-WASM con máxima prioridad
// Este archivo asegura que ZBar-WASM tenga la máxima prioridad en la detección

export const ZBAR_PRIORITY_CONFIG = {
  // Configuración principal - ZBar-WASM SIEMPRE primero
  ZBAR_SCAN_INTERVAL: 300, // ms - más frecuente para máxima prioridad
  QUAGGA_FALLBACK_DELAY: 600, // ms - retraso para dar prioridad a ZBar

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
