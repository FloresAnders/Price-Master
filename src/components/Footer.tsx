// src/components/Footer.tsx
'use client';

import React, { useState } from 'react';

export default function Footer() {
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const sections = [
    { title: 'Productos', items: ['Escáner de Códigos', 'Cámara en Vivo', 'Detección Multi-formato', 'Análisis ZBar-WASM'] },
    { title: 'Empresa', items: ['Acerca de', { name: 'Equipo', action: () => setIsGitHubModalOpen(true) }, 'Carreras', 'Contacto'] },
    { title: 'Tecnologías', items: ['Next.js 15', 'React 19', 'TypeScript', 'Firebase'] },
    { title: 'Soporte', items: ['Documentación', 'Preguntas Frecuentes', 'Contacto', 'Términos'] },
  ];
  return (
    <footer className="mt-auto border-t border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)]">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-2 sm:py-3 overflow-x-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-3 text-xs sm:text-sm">
          <div className="text-center sm:text-left">
            <span>© 2025 Price Master - Escáner avanzado de códigos de barras y QR</span>
          </div>
          <div className="flex flex-wrap items-center justify-center space-x-2 sm:space-x-3">
            {['Next.js 15', 'React 19', 'TypeScript', 'ZBar-WASM', 'Quagga2', 'Firebase'].map((tech, idx) => (
              <React.Fragment key={tech}>
                <span className="hover:text-[var(--tab-hover-text)] transition-colors text-[var(--tab-text)] whitespace-nowrap">
                  {tech}
                </span>
                {idx < 5 && <span className="text-[var(--input-border)]">•</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
        {/* Additional footer sections */}
        <div className="mt-2 sm:mt-4 pt-2 sm:pt-4 border-t border-[var(--input-border)]">
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            {sections.map(section => (
              <div key={section.title}>
                <div className="font-semibold mb-1 sm:mb-2 text-[var(--tab-text)]">{section.title}</div>
                <ul className="space-y-1">
                  {section.items.map((item, idx) => (
                    typeof item === 'string' ? (
                      <li key={idx} className="text-[var(--tab-text)] hover:text-[var(--tab-hover-text)] cursor-pointer transition-colors text-xs sm:text-sm">{item}</li>
                    ) : (
                      <li key={idx} className="text-[var(--tab-text)] hover:text-[var(--tab-hover-text)] cursor-pointer transition-colors text-xs sm:text-sm underline" onClick={item.action}>{item.name}</li>
                    )
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        {/* Modal GitHub */}
        {isGitHubModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-[var(--card-bg)] text-[var(--foreground)] rounded-lg shadow-lg p-6 w-full max-w-xs border border-[var(--input-border)] flex flex-col items-center">
              <h2 className="text-lg font-bold mb-2">Equipo / GitHub</h2>
              <div className="mb-4 text-center">
                <span className="block font-semibold">Usuario GitHub:</span>
                <a href="https://github.com/andersfcb" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">@andersfcb</a>
              </div>
              <button
                className="mt-2 px-4 py-2 rounded bg-[var(--button-bg)] text-[var(--button-text)] hover:bg-[var(--button-hover)]"
                onClick={() => setIsGitHubModalOpen(false)}
              >Cerrar</button>
            </div>
          </div>
        )}
      </div>
    </footer>
  );
}
