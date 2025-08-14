// Test script para las URLs cortas del escáner móvil (versión simplificada)
import { encodeData, decodeData, generateShortMobileUrl } from './src/utils/shortEncoder.js';

function testShortUrls() {
  console.log('🧪 Probando la implementación simplificada de URLs cortas...\n');

  // Test original URL vs short URL
  const originalUrl = 'http://localhost:3000/mobile-scan?session=scan-1755184708500-375fnhebp&rpn=t';
  console.log('URL original:', originalUrl);
  console.log('Longitud:', originalUrl.length, 'caracteres\n');

  // Test encoding with requestProductName
  const encoded = encodeData('scan-1755184708500-375fnhebp', true);
  console.log('Código codificado (con rpn):', encoded);
  console.log('Longitud del código:', encoded.length, 'caracteres');

  // Test encoding without requestProductName
  const encodedSimple = encodeData('scan-1755184708500-375fnhebp', false);
  console.log('Código codificado (sin rpn):', encodedSimple);
  console.log('Longitud del código:', encodedSimple.length, 'caracteres\n');

  // Generate short URLs
  const shortUrlWithRpn = generateShortMobileUrl('http://localhost:3000', 'scan-1755184708500-375fnhebp', true);
  const shortUrlSimple = generateShortMobileUrl('http://localhost:3000', 'scan-1755184708500-375fnhebp', false);
  
  console.log('URL corta (con rpn):', shortUrlWithRpn);
  console.log('Longitud:', shortUrlWithRpn.length, 'caracteres');
  console.log('URL corta (sin rpn):', shortUrlSimple);
  console.log('Longitud:', shortUrlSimple.length, 'caracteres\n');

  // Calculate compression ratio
  const compressionRatio = ((originalUrl.length - shortUrlWithRpn.length) / originalUrl.length * 100).toFixed(1);
  console.log(`📊 Reducción de tamaño: ${compressionRatio}%\n`);

  // Test decoding
  const decoded = decodeData(encoded);
  console.log('Decodificación (con rpn):');
  console.log('  Session:', decoded?.session);
  console.log('  Request Product Name:', decoded?.requestProductName);

  const decodedSimple = decodeData(encodedSimple);
  console.log('\nDecodificación (sin rpn):');
  console.log('  Session:', decodedSimple?.session);
  console.log('  Request Product Name:', decodedSimple?.requestProductName);

  // Verify integrity
  const isValid = decoded?.session === 'scan-1755184708500-375fnhebp' && decoded?.requestProductName === true;
  const isValidSimple = decodedSimple?.session === 'scan-1755184708500-375fnhebp' && decodedSimple?.requestProductName === false;
  
  console.log('\n✅ Integridad de datos (con rpn):', isValid ? 'CORRECTA' : 'ERROR');
  console.log('✅ Integridad de datos (sin rpn):', isValidSimple ? 'CORRECTA' : 'ERROR');

  console.log('\n🎉 ¡Pruebas completadas!');
  console.log('✨ Simplificación exitosa:');
  console.log('  - Solo URLs cortas (sin fallback)');
  console.log('  - rpn = requestProductName');
  console.log('  - Sin soporte para locations');
}

// Test si se ejecuta directamente
if (typeof window === 'undefined') {
  testShortUrls();
}

export { testShortUrls };
