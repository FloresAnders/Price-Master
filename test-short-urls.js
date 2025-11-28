// Test script para las URLs cortas del escáner móvil (versión simplificada)
import { encodeData, decodeData, generateShortMobileUrl } from './src/utils/shortEncoder.js';

function testShortUrls() {
  //('🧪 Probando la implementación simplificada de URLs cortas...\n');

  // Test original URL vs short URL
  const originalUrl = 'http://localhost:3000/mobile-scan?session=scan-1755184708500-375fnhebp&rpn=t';
  //('URL original:', originalUrl);
  //('Longitud:', originalUrl.length, 'caracteres\n');

  // Test encoding with requestProductName
  const encoded = encodeData('scan-1755184708500-375fnhebp', true);
  //('Código codificado (con rpn):', encoded);
  //('Longitud del código:', encoded.length, 'caracteres');

  // Test encoding without requestProductName
  const encodedSimple = encodeData('scan-1755184708500-375fnhebp', false);
  //('Código codificado (sin rpn):', encodedSimple);
  //('Longitud del código:', encodedSimple.length, 'caracteres\n');

  // Generate short URLs
  const shortUrlWithRpn = generateShortMobileUrl('http://localhost:3000', 'scan-1755184708500-375fnhebp', true);
  const shortUrlSimple = generateShortMobileUrl('http://localhost:3000', 'scan-1755184708500-375fnhebp', false);
  
  //('URL corta (con rpn):', shortUrlWithRpn);
  //('Longitud:', shortUrlWithRpn.length, 'caracteres');
  //('URL corta (sin rpn):', shortUrlSimple);
  //('Longitud:', shortUrlSimple.length, 'caracteres\n');

  // Calculate compression ratio
  const compressionRatio = ((originalUrl.length - shortUrlWithRpn.length) / originalUrl.length * 100).toFixed(1);
  //(`📊 Reducción de tamaño: ${compressionRatio}%\n`);

  // Test decoding
  const decoded = decodeData(encoded);
  //('Decodificación (con rpn):');
  //('  Session:', decoded?.session);
  //('  Request Product Name:', decoded?.requestProductName);

  const decodedSimple = decodeData(encodedSimple);
  //('\nDecodificación (sin rpn):');
  //('  Session:', decodedSimple?.session);
  //('  Request Product Name:', decodedSimple?.requestProductName);

  // Verify integrity
  const isValid = decoded?.session === 'scan-1755184708500-375fnhebp' && decoded?.requestProductName === true;
  const isValidSimple = decodedSimple?.session === 'scan-1755184708500-375fnhebp' && decodedSimple?.requestProductName === false;
  
  //('\n✅ Integridad de datos (con rpn):', isValid ? 'CORRECTA' : 'ERROR');
  //('✅ Integridad de datos (sin rpn):', isValidSimple ? 'CORRECTA' : 'ERROR');

  //('\n🎉 ¡Pruebas completadas!');
  //('✨ Simplificación exitosa:');
  //('  - Solo URLs cortas (sin fallback)');
  //('  - rpn = requestProductName');
  //('  - Sin soporte para locations');
}

// Test si se ejecuta directamente
if (typeof window === 'undefined') {
  testShortUrls();
}

export { testShortUrls };
