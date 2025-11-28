/**
 * Ejemplo de uso del Clipboard con @capacitor/clipboard
 * 
 * El plugin de Clipboard NO requiere permisos especiales en Android ni iOS.
 * Solo necesita estar instalado: npm install @capacitor/clipboard
 */

import React from 'react';
import { Clipboard } from '@capacitor/clipboard';
import { usePermissions } from '@/hooks/usePermissions';

// ============================================
// MÉTODO 1: Usar el hook usePermissions
// ============================================

export function ClipboardWithHookExample() {
  const { copyToClipboard, readFromClipboard } = usePermissions();

  const handleCopy = async () => {
    const success = await copyToClipboard('¡Hola Álvaro!');
    if (success) {
      //('✅ Texto copiado al portapapeles');
      alert('✅ Texto copiado');
    } else {
      console.error('❌ Error al copiar');
    }
  };

  const handlePaste = async () => {
    const text = await readFromClipboard();
    if (text) {
      //('📋 Texto del portapapeles:', text);
      alert(`📋 Contenido: ${text}`);
    } else {
      alert('⚠️ No hay texto en el portapapeles');
    }
  };

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-bold">Ejemplo con Hook</h2>
      <button
        onClick={handleCopy}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Copiar texto
      </button>
      <button
        onClick={handlePaste}
        className="px-4 py-2 bg-green-500 text-white rounded"
      >
        Leer portapapeles
      </button>
    </div>
  );
}

// ============================================
// MÉTODO 2: Usar directamente el plugin
// ============================================

export async function directClipboardExamples() {
  // Copiar texto simple
  await Clipboard.write({
    string: 'Hola Álvaro desde Time Master'
  });
  //('✅ Texto copiado');

  // Leer texto del portapapeles
  const { value, type } = await Clipboard.read();
  //('📋 Contenido:', value);
  //('📋 Tipo:', type);

  // Copiar URL
  await Clipboard.write({
    url: 'https://timemaster.app'
  });

  // Copiar imagen en base64
  await Clipboard.write({
    image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...'
  });
}

// ============================================
// MÉTODO 3: Componente completo con UI
// ============================================

export function ClipboardManagerComponent() {
  const { copyToClipboard, readFromClipboard } = usePermissions();
  const [clipboardContent, setClipboardContent] = React.useState<string>('');
  const [inputText, setInputText] = React.useState<string>('');

  const handleCopy = async () => {
    if (!inputText.trim()) {
      alert('⚠️ Escribe algo primero');
      return;
    }

    const success = await copyToClipboard(inputText);
    if (success) {
      alert('✅ Copiado al portapapeles');
    } else {
      alert('❌ Error al copiar');
    }
  };

  const handleRead = async () => {
    const text = await readFromClipboard();
    if (text) {
      setClipboardContent(text);
    } else {
      setClipboardContent('(vacío)');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-bold">Gestor de Portapapeles</h2>

      {/* Copiar */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          Texto a copiar:
        </label>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="w-full px-3 py-2 border rounded"
          placeholder="Escribe algo..."
        />
        <button
          onClick={handleCopy}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          📋 Copiar al portapapeles
        </button>
      </div>

      {/* Leer */}
      <div className="space-y-2">
        <button
          onClick={handleRead}
          className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          📖 Leer portapapeles
        </button>
        {clipboardContent && (
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">Contenido:</p>
            <p className="font-mono text-sm break-all">{clipboardContent}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// NOTAS IMPORTANTES
// ============================================

/*
✅ VENTAJAS del plugin @capacitor/clipboard:
- Funciona en iOS, Android y Web
- No requiere permisos especiales
- API simple y consistente
- Soporta texto, URLs e imágenes

⚠️ CONSIDERACIONES:
- En web, puede requerir HTTPS
- El usuario debe interactuar primero (click)
- Algunos navegadores pueden mostrar un prompt de permisos

📱 USO EN PRODUCCIÓN:
1. Ya está instalado: @capacitor/clipboard
2. Ya está configurado en capacitor.config.ts
3. Ya está sincronizado con Android
4. Listo para usar en tu app
*/
