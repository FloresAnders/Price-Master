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
  //('🔬 Comparando tamaños de Session ID y URLs...\n');

  // Session ID formato anterior (largo)
  const oldSessionId = 'scan-1755184708500-375fnhebp';
  //('📊 Session ID ANTERIOR:');
  //('  Formato:', oldSessionId);
  //('  Longitud:', oldSessionId.length, 'caracteres\n');

  // Session ID formato nuevo (corto)
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 6);
  const newSessionId = `${timestamp}${random}`;
  
  //('📊 Session ID NUEVO:');
  //('  Formato:', newSessionId);
  //('  Longitud:', newSessionId.length, 'caracteres');
  
  const sessionIdReduction = ((oldSessionId.length - newSessionId.length) / oldSessionId.length * 100).toFixed(1);
  //('  Reducción:', sessionIdReduction + '%\n');

  // URLs completas con session ID anterior
  const oldEncodedWithRpn = simulateEncoding(oldSessionId, true);
  const oldUrlWithRpn = simulateShortUrl('http://localhost:3000', oldSessionId, true);
  
  //('📱 URL ANTERIOR (con rpn):');
  //('  Código:', oldEncodedWithRpn);
  //('  URL:', oldUrlWithRpn);
  //('  Longitud total:', oldUrlWithRpn.length, 'caracteres\n');

  // URLs completas con session ID nuevo
  const newEncodedWithRpn = simulateEncoding(newSessionId, true);
  const newUrlWithRpn = simulateShortUrl('http://localhost:3000', newSessionId, true);
  
  //('📱 URL NUEVA (con rpn):');
  //('  Código:', newEncodedWithRpn);
  //('  URL:', newUrlWithRpn);
  //('  Longitud total:', newUrlWithRpn.length, 'caracteres\n');

  // Comparación final
  const urlReduction = ((oldUrlWithRpn.length - newUrlWithRpn.length) / oldUrlWithRpn.length * 100).toFixed(1);
  //('🎯 RESULTADO FINAL:');
  //('  Session ID reducido:', sessionIdReduction + '%');
  //('  URL total reducida:', urlReduction + '%');
  //('  Caracteres ahorrados:', (oldUrlWithRpn.length - newUrlWithRpn.length), 'caracteres');

  // Test sin rpn también
  const oldEncodedSimple = simulateEncoding(oldSessionId, false);
  const oldUrlSimple = simulateShortUrl('http://localhost:3000', oldSessionId, false);
  
  const newEncodedSimple = simulateEncoding(newSessionId, false);
  const newUrlSimple = simulateShortUrl('http://localhost:3000', newSessionId, false);
  
  //('\n📱 COMPARACIÓN SIN RPN:');
  //('  URL anterior:', oldUrlSimple, '(' + oldUrlSimple.length + ' chars)');
  //('  URL nueva:', newUrlSimple, '(' + newUrlSimple.length + ' chars)');
  
  const simpleUrlReduction = ((oldUrlSimple.length - newUrlSimple.length) / oldUrlSimple.length * 100).toFixed(1);
  //('  Reducción sin rpn:', simpleUrlReduction + '%');

  //('\n✨ ¡Optimización exitosa!');
  
  // Mostrar ejemplos de URLs reales que se generarían
  //('\n🌐 EJEMPLOS DE URLs QUE SE GENERAN AHORA:');
  //('  Sin rpn:', newUrlSimple);
  //('  Con rpn:', newUrlWithRpn);
}

// Ejecutar test
testSessionIdOptimization();
