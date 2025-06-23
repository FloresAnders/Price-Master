// Funciones utilitarias para BarcodeScanner

// --- Detección básica de patrones (mejorada para imágenes borrosas y decodificación a dígitos) ---
export function detectBasicPatternWithOrientation(imageData: ImageData): string | null {
  function blurImage(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const out = new Uint8ClampedArray(data.length);
    const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
    const kSum = 16;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let r = 0, g = 0, b = 0;
        let idx = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const i = ((y + ky) * width + (x + kx)) * 4;
            r += data[i] * kernel[idx];
            g += data[i + 1] * kernel[idx];
            b += data[i + 2] * kernel[idx];
            idx++;
          }
        }
        const o = (y * width + x) * 4;
        out[o] = r / kSum;
        out[o + 1] = g / kSum;
        out[o + 2] = b / kSum;
        out[o + 3] = data[o + 3];
      }
    }
    return out;
  }
  function adaptiveThresholdLine(data: Uint8ClampedArray, width: number, y: number): number {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      sum += gray;
    }
    return sum / width;
  }
  function analyzeLine(data: Uint8ClampedArray, width: number, y: number, threshold: number): string {
    let bin = '';
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      bin += gray < threshold ? '1' : '0';
    }
    return bin;
  }
  function getBestBinarySequence(data: Uint8ClampedArray, width: number, height: number): string {
    const lines = 15;
    const startY = Math.floor(height * 0.3);
    const endY = Math.floor(height * 0.7);
    const step = Math.max(1, Math.floor((endY - startY) / lines));
    const binaries: string[] = [];
    for (let i = 0; i < lines; i++) {
      const y = startY + i * step;
      if (y < height) {
        const th = adaptiveThresholdLine(data, width, y);
        binaries.push(analyzeLine(data, width, y, th));
      }
    }
    const counts: Record<string, number> = {};
    for (const bin of binaries) {
      counts[bin] = (counts[bin] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }
  // Decodifica la secuencia binaria a dígitos EAN/UPC aproximados
  function tryDecodeEANtoDigits(bin: string): string | null {
    // Busca patrones de guardas EAN-13: 101...101...101
    const left = bin.indexOf('101');
    const right = bin.lastIndexOf('101');
    if (left !== -1 && right !== -1 && right > left + 30) {
      const payload = bin.slice(left + 3, right);
      // Divide en 12-13 segmentos (EAN-13)
      const seg = Math.floor(payload.length / 12);
      if (seg > 2) {
        let digits = '';
        for (let i = 0; i < 12; i++) {
          const chunk = payload.slice(i * seg, (i + 1) * seg);
          // Calcula la proporción de barras negras
          const ones = chunk.split('').filter((c) => c === '1').length;
          const ratio = ones / seg;
          //más de 70% negro = 1, menos de 30% = 0, intermedios = 7, 4, 3, etc.
          if (ratio > 0.7) digits += '1';
          else if (ratio < 0.3) digits += '0';
          else if (ratio > 0.55) digits += '7';
          else if (ratio > 0.45) digits += '4';
          else if (ratio > 0.35) digits += '3';
          else digits += '2';
        }
        return digits;
      }
    }
    return null;
  }
  // --- Proceso principal ---
  const { data, width, height } = imageData;
  const blurred = blurImage(data, width, height);
  // Horizontal
  let bin = getBestBinarySequence(blurred, width, height);
  let decoded = tryDecodeEANtoDigits(bin);
  if (decoded) return `BASIC_EAN_DIGITS_${decoded}`;
  // Si no, intenta vertical
  const rotated = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = (x * height + (height - 1 - y)) * 4;
      rotated[dstIdx] = data[srcIdx];
      rotated[dstIdx + 1] = data[srcIdx + 1];
      rotated[dstIdx + 2] = data[srcIdx + 2];
      rotated[dstIdx + 3] = data[srcIdx + 3];
    }
  }
  bin = getBestBinarySequence(rotated, height, width);
  decoded = tryDecodeEANtoDigits(bin);
  if (decoded) return `BASIC_EAN_DIGITS_VERTICAL_${decoded}`;
  // Si no se puede decodificar, devuelve la secuencia binaria horizontal para debug
  return `BASIC_BIN_${bin.slice(0, 64)}...`;
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
export async function detectWithQuagga2(imageData: ImageData, fallbackDelay: number = 0): Promise<string | null> {
  // Usar requestAnimationFrame para procesamiento inmediato sin bloquear UI
  await new Promise(resolve => requestAnimationFrame(resolve));

  // El fallbackDelay ahora es 0 para análisis inmediato
  if (fallbackDelay > 0) {
    await new Promise(resolve => setTimeout(resolve, fallbackDelay));
  }

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
