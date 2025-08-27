import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

const instructions = [
  'Nota: Escriba T11, T10, NNN o TTT en cualquier momento para abrir el modal de entrada.',
  'Mantén presionado un ticket más de 1 segundo para editarlo (en carrusel y en grid).',
  'Para eliminar un ticket, usa el botón ✕ en la esquina del ticket activo.',
  'Puedes cambiar entre modo carrusel y ver todos con el botón de capas.',
  'Navega entre tickets con las flechas del teclado en modo carrusel.',
  'Filtra los tickets por sorteo usando el selector superior.',
  'El monto puede dejarse vacío al editar y luego ingresar el nuevo valor.',
  'Todos los cambios se guardan automáticamente.',
  'Haz click en "Ver resumen" para ver el total por sorteo.',
  'Puedes exportar la lista como imagen con el botón "Exportar JPG".',
  'Para limpiar todos los tickets, usa el botón "Limpiar todo".',
];

export default function HelpTooltip() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block text-left">
      <button
        className="flex items-center gap-2 p-2 rounded-full bg-yellow-200 dark:bg-yellow-500 hover:bg-yellow-300 dark:hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg animate-bounce"
        title="Ayuda"
        onClick={() => setOpen(o => !o)}
        aria-label="Mostrar instrucciones"
        type="button"
        style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.02em' }}
      >
        <HelpCircle className="w-6 h-6 text-blue-700 animate-pulse" />
        <span className="text-blue-900 dark:text-blue-900 font-extrabold drop-shadow-lg animate-pulse" style={{ textShadow: '0 2px 8px #fff, 0 0 2px #facc15' }}>
          Instrucciones
        </span>
      </button>
      {open && (
        <div className="absolute z-[9999] mt-2 right-0 w-80 max-w-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg p-4 text-sm text-gray-900 dark:text-gray-100" style={{ pointerEvents: 'auto' }}>
          <h4 className="font-bold mb-2 text-blue-700 dark:text-blue-300">Instrucciones de uso</h4>
          <ul className="list-disc pl-5 space-y-1">
            {instructions.map((inst, i) => (
              <li key={i}>{inst}</li>
            ))}
          </ul>
          <button
            className="mt-3 px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-xs float-right"
            onClick={() => setOpen(false)}
          >Cerrar</button>
        </div>
      )}
    </div>
  );
}
