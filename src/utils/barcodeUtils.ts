// Funciones utilitarias para BarcodeScanner

// --- Detección básica de patrones (fallback si ZBar y Quagga2 fallan) ---
export function detectBasicPatternWithOrientation(imageData: ImageData): string | null {
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
      return { transitions, pattern, averageWidth: 0 };
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
}

// --- Preprocesado de imagen (ajuste de contraste) ---
export function preprocessImage(imageData: ImageData): ImageData {
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
}

// --- Decodificación con Quagga2 (imagen estática) ---
export async function detectWithQuagga2(imageData: ImageData): Promise<string | null> {
  // Import dinámico para evitar require y problemas SSR
  const Quagga = (await import('@ericblade/quagga2')).default;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  ctx.putImageData(imageData, 0, 0);
  return new Promise((resolve) => {
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
        debug: false,
      },
      (result: { codeResult?: { code: string | null } } | undefined) => {
        if (result && result.codeResult && result.codeResult.code) {
          resolve(result.codeResult.code);
        } else {
          resolve(null);
        }
      }
    );
  });
}
