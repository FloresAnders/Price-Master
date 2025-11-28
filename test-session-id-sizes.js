// Test script para comparar el tamaño de los session IDs
function testSessionIdSizes() {
  //('🧪 Comparando tamaños de Session ID...\n');

  // Función original (larga)
  function generateLongSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Función nueva (corta)
  function generateShortSessionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 6);
    return `${timestamp}${random}`;
  }

  // Generar ejemplos
  const longId = generateLongSessionId();
  const shortId = generateShortSessionId();

  //('📏 Session ID Original (largo):');
  //(`   ${longId}`);
  //(`   Longitud: ${longId.length} caracteres\n`);

  //('✨ Session ID Nuevo (corto):');
  //(`   ${shortId}`);
  //(`   Longitud: ${shortId.length} caracteres\n`);

  // Calcular reducción
  const reduction = ((longId.length - shortId.length) / longId.length * 100).toFixed(1);
  //(`📊 Reducción de tamaño: ${reduction}%`);
  //(`🎯 Caracteres ahorrados: ${longId.length - shortId.length}\n`);

  // Test de URLs completas
  //('🔗 Impacto en URLs completas:');
  
  const baseUrl = 'http://localhost:3000/mobile-scan?session=';
  const longUrl = `${baseUrl}${longId}&rpn=t`;
  const shortUrl = `${baseUrl}${shortId}&rpn=t`;

  //(`   URL con ID largo: ${longUrl}`);
  //(`   Longitud: ${longUrl.length} caracteres\n`);
  
  //(`   URL con ID corto: ${shortUrl}`);
  //(`   Longitud: ${shortUrl.length} caracteres\n`);

  const urlReduction = ((longUrl.length - shortUrl.length) / longUrl.length * 100).toFixed(1);
  //(`📈 Reducción total en URL: ${urlReduction}%`);
  //(`🎉 Caracteres ahorrados en URL: ${longUrl.length - shortUrl.length}`);
}

testSessionIdSizes();
