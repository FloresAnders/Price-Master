/**
 * Simple QR Code generator using a public API
 * This is a lightweight solution for generating QR codes without additional dependencies
 */

export function generateQRCodeUrl(text: string, size: number = 200): string {
  // Using QR Server API - a free service for generating QR codes
  const baseUrl = 'https://api.qrserver.com/v1/create-qr-code/';
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    data: encodeURIComponent(text),
    format: 'png',
    bgcolor: 'ffffff',
    color: '000000',
    qzone: '2',
    margin: '10'
  });
  
  return `${baseUrl}?${params.toString()}`;
}

export function generateQRCodeSVG(text: string, size: number = 200): string {
  // Simple SVG QR code placeholder
  // In a real implementation, you'd use a library like qrcode-generator
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <rect x="10" y="10" width="20" height="20" fill="black"/>
      <rect x="40" y="10" width="20" height="20" fill="black"/>
      <rect x="70" y="10" width="20" height="20" fill="black"/>
      <rect x="10" y="40" width="20" height="20" fill="black"/>
      <rect x="70" y="40" width="20" height="20" fill="black"/>
      <rect x="10" y="70" width="20" height="20" fill="black"/>
      <rect x="40" y="70" width="20" height="20" fill="black"/>
      <rect x="70" y="70" width="20" height="20" fill="black"/>
      <text x="${size/2}" y="${size - 20}" text-anchor="middle" font-family="monospace" font-size="8" fill="black">
        QR: ${text.slice(-15)}...
      </text>
    </svg>
  `;
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers or non-HTTPS
    return new Promise((resolve, reject) => {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'absolute';
      textArea.style.left = '-999999px';
      
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        textArea.remove();
        resolve();
      } catch (error) {
        textArea.remove();
        reject(error);
      }
    });
  }
}
