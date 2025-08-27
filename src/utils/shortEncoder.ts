import LZString from "lz-string";
import baseX from "base-x";

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const base62 = baseX(BASE62);

/**
 * Encode session parameters into a short URL-safe string
 * @param session - Session ID
 * @param requestProductName - Request product name parameter (optional)
 * @returns Short encoded string
 */
export function encodeData(
  session: string,
  requestProductName?: boolean
): string {
  // Build query parameters string
  const params = new URLSearchParams();
  params.set('session', session);

  if (requestProductName) {
    params.set('rpn', 't');
  }

  const paramsString = params.toString();

  try {
    // Compress the parameters string
    const compressed = LZString.compressToBase64(paramsString);

    if (!compressed) {
      throw new Error('Compression failed');
    }

    // Convert to Base62 for URL-safe encoding
    const buffer = Buffer.from(compressed, 'base64');
    return base62.encode(buffer);
  } catch (error) {
    console.error('Error encoding data:', error);
    // Fallback to simple base64 if compression fails
    return Buffer.from(paramsString).toString('base64').replace(/[+/=]/g, '');
  }
}

/**
 * Decode short string back to session parameters
 * @param encoded - Encoded string from URL
 * @returns Object with decoded parameters or null if invalid
 */
export function decodeData(encoded: string): {
  session: string | null;
  requestProductName: boolean;
} | null {
  try {
    // Decode from Base62
    const buffer = base62.decode(encoded);
    const compressed = Buffer.from(buffer).toString('base64');

    // Decompress
    const decompressed = LZString.decompressFromBase64(compressed);

    if (!decompressed) {
      throw new Error('Decompression failed');
    }

    // Parse as URLSearchParams
    const searchParams = new URLSearchParams(decompressed);

    return {
      session: searchParams.get("session"),
      requestProductName: searchParams.get("rpn") === 't'
    };
  } catch (error) {
    console.error('Error decoding data:', error);

    // Fallback: try to decode as simple base64
    try {
      // Add padding if needed
      let padded = encoded;
      while (padded.length % 4) {
        padded += '=';
      }

      const fallbackDecoded = Buffer.from(padded, 'base64').toString();
      const searchParams = new URLSearchParams(fallbackDecoded);

      return {
        session: searchParams.get("session"),
        requestProductName: searchParams.get("rpn") === 't'
      };
    } catch (fallbackError) {
      console.error('Fallback decoding also failed:', fallbackError);
      return null;
    }
  }
}

/**
 * Generate a short mobile URL
 * @param baseUrl - Base URL (e.g., http://localhost:3000)
 * @param session - Session ID
 * @param requestProductName - Request product name parameter (optional)
 * @returns Short mobile URL
 */
export function generateShortMobileUrl(
  baseUrl: string,
  session: string,
  requestProductName?: boolean
): string {
  const encoded = encodeData(session, requestProductName);
  return `${baseUrl}/mobile-scan/${encoded}`;
}
