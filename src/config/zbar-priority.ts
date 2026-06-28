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
  MAX_CODE_LENGTH: 14,
  VALID_CODE_PATTERN: /^[0-9]+$/,
  STABLE_READ_COUNT: 3,

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

export const isValidGs1Checksum = (code: string): boolean => {
  const normalized = String(code || "").trim();
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(normalized)) {
    return false;
  }

  const checkDigit = Number(normalized.at(-1));
  const body = normalized.slice(0, -1);
  let sum = 0;

  for (let i = body.length - 1, position = 0; i >= 0; i--, position++) {
    const digit = Number(body[i]);
    sum += digit * (position % 2 === 0 ? 3 : 1);
  }

  return (10 - (sum % 10)) % 10 === checkDigit;
};

export const isAcceptedBarcodeValue = (code: unknown): code is string => {
  const normalized = String(code ?? "").trim();
  return (
    ZBAR_PRIORITY_CONFIG.VALID_CODE_PATTERN.test(normalized) &&
    normalized.length >= ZBAR_PRIORITY_CONFIG.MIN_CODE_LENGTH &&
    normalized.length <= ZBAR_PRIORITY_CONFIG.MAX_CODE_LENGTH &&
    isValidGs1Checksum(normalized)
  );
};

export const createStableCodeDetector = (
  requiredReads = ZBAR_PRIORITY_CONFIG.STABLE_READ_COUNT,
) => {
  let lastCode = "";
  let count = 0;
  let emittedCode = "";

  return (code: unknown): string | null => {
    const normalized = String(code ?? "").trim();
    if (!isAcceptedBarcodeValue(normalized)) return null;

    if (normalized !== lastCode) {
      lastCode = normalized;
      count = 1;
      return null;
    }

    count += 1;
    if (count < requiredReads || emittedCode === normalized) return null;

    emittedCode = normalized;
    return normalized;
  };
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
    void logMessage;
    void data;
  }
};

export default ZBAR_PRIORITY_CONFIG;
