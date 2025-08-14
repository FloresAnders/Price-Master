// Test de comparación de tamaños de session ID y URLs (versión simplificada)

// Simulación de las funciones de encoding
function simulateEncoding(sessionId, requestProductName) {
  const params = new URLSearchParams();
  params.set('session', sessionId);
  if (requestProductName) {
    params.set('rpn', 't');
  }
  const paramsString = params.toString();
  
  // Simulación de compresión: base64 simple
  const encoded = Buffer.from(paramsString).toString('base64').replace(/[+/=]/g, '');
  return encoded;
}

function simulateShortUrl(baseUrl, sessionId, requestProductName) {
  const encoded = simulateEncoding(sessionId, requestProductName);
  return `${baseUrl}/mobile-scan/${encoded}`;
}

function testSessionIdOptimization() {
  console.log('🔬 Comparando tamaños de Session ID y URLs...\n');

  // Session ID formato anterior (largo)
  const oldSessionId = 'scan-1755184708500-375fnhebp';
  console.log('📊 Session ID ANTERIOR:');
  console.log('  Formato:', oldSessionId);
  console.log('  Longitud:', oldSessionId.length, 'caracteres\n');

  // Session ID formato nuevo (corto)
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 6);
  const newSessionId = `${timestamp}${random}`;
  
  console.log('📊 Session ID NUEVO:');
  console.log('  Formato:', newSessionId);
  console.log('  Longitud:', newSessionId.length, 'caracteres');
  
  const sessionIdReduction = ((oldSessionId.length - newSessionId.length) / oldSessionId.length * 100).toFixed(1);
  console.log('  Reducción:', sessionIdReduction + '%\n');

  // URLs completas con session ID anterior
  const oldEncodedWithRpn = simulateEncoding(oldSessionId, true);
  const oldUrlWithRpn = simulateShortUrl('http://localhost:3000', oldSessionId, true);
  
  console.log('📱 URL ANTERIOR (con rpn):');
  console.log('  Código:', oldEncodedWithRpn);
  console.log('  URL:', oldUrlWithRpn);
  console.log('  Longitud total:', oldUrlWithRpn.length, 'caracteres\n');

  // URLs completas con session ID nuevo
  const newEncodedWithRpn = simulateEncoding(newSessionId, true);
  const newUrlWithRpn = simulateShortUrl('http://localhost:3000', newSessionId, true);
  
  console.log('📱 URL NUEVA (con rpn):');
  console.log('  Código:', newEncodedWithRpn);
  console.log('  URL:', newUrlWithRpn);
  console.log('  Longitud total:', newUrlWithRpn.length, 'caracteres\n');

  // Comparación final
  const urlReduction = ((oldUrlWithRpn.length - newUrlWithRpn.length) / oldUrlWithRpn.length * 100).toFixed(1);
  console.log('🎯 RESULTADO FINAL:');
  console.log('  Session ID reducido:', sessionIdReduction + '%');
  console.log('  URL total reducida:', urlReduction + '%');
  console.log('  Caracteres ahorrados:', (oldUrlWithRpn.length - newUrlWithRpn.length), 'caracteres');

  // Test sin rpn también
  const oldEncodedSimple = simulateEncoding(oldSessionId, false);
  const oldUrlSimple = simulateShortUrl('http://localhost:3000', oldSessionId, false);
  
  const newEncodedSimple = simulateEncoding(newSessionId, false);
  const newUrlSimple = simulateShortUrl('http://localhost:3000', newSessionId, false);
  
  console.log('\n📱 COMPARACIÓN SIN RPN:');
  console.log('  URL anterior:', oldUrlSimple, '(' + oldUrlSimple.length + ' chars)');
  console.log('  URL nueva:', newUrlSimple, '(' + newUrlSimple.length + ' chars)');
  
  const simpleUrlReduction = ((oldUrlSimple.length - newUrlSimple.length) / oldUrlSimple.length * 100).toFixed(1);
  console.log('  Reducción sin rpn:', simpleUrlReduction + '%');

  console.log('\n✨ ¡Optimización exitosa!');
  
  // Mostrar ejemplos de URLs reales que se generarían
  console.log('\n🌐 EJEMPLOS DE URLs QUE SE GENERAN AHORA:');
  console.log('  Sin rpn:', newUrlSimple);
  console.log('  Con rpn:', newUrlWithRpn);
}

// Ejecutar test
testSessionIdOptimization();
