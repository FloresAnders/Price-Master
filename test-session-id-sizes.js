// Test script para comparar el tamaño de los session IDs
function testSessionIdSizes() {
  console.log('🧪 Comparando tamaños de Session ID...\n');

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

  console.log('📏 Session ID Original (largo):');
  console.log(`   ${longId}`);
  console.log(`   Longitud: ${longId.length} caracteres\n`);

  console.log('✨ Session ID Nuevo (corto):');
  console.log(`   ${shortId}`);
  console.log(`   Longitud: ${shortId.length} caracteres\n`);

  // Calcular reducción
  const reduction = ((longId.length - shortId.length) / longId.length * 100).toFixed(1);
  console.log(`📊 Reducción de tamaño: ${reduction}%`);
  console.log(`🎯 Caracteres ahorrados: ${longId.length - shortId.length}\n`);

  // Test de URLs completas
  console.log('🔗 Impacto en URLs completas:');
  
  const baseUrl = 'http://localhost:3000/mobile-scan?session=';
  const longUrl = `${baseUrl}${longId}&rpn=t`;
  const shortUrl = `${baseUrl}${shortId}&rpn=t`;

  console.log(`   URL con ID largo: ${longUrl}`);
  console.log(`   Longitud: ${longUrl.length} caracteres\n`);
  
  console.log(`   URL con ID corto: ${shortUrl}`);
  console.log(`   Longitud: ${shortUrl.length} caracteres\n`);

  const urlReduction = ((longUrl.length - shortUrl.length) / longUrl.length * 100).toFixed(1);
  console.log(`📈 Reducción total en URL: ${urlReduction}%`);
  console.log(`🎉 Caracteres ahorrados en URL: ${longUrl.length - shortUrl.length}`);
}

testSessionIdSizes();
