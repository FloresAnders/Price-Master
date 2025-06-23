// src/components/Footer.tsx
'use client';

import React from 'react';

export default function Footer() {
  const sections = [
    { title: 'Productos', items: ['Escáner de Códigos', 'Cámara en Vivo', 'Detección Multi-formato', 'Análisis ZBar-WASM'] },
    { title: 'Empresa', items: ['Acerca de', 'Equipo', 'Carreras', 'Contacto'] },
    { title: 'Tecnologías', items: ['Next.js 15', 'React 19', 'TypeScript', 'Firebase'] },
    { title: 'Soporte', items: ['Documentación', 'Preguntas Frecuentes', 'Contacto', 'Términos'] },
  ];
  return (
    <footer className="mt-auto border-t border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-sm">
          <div className="text-center sm:text-left">
            <span>© 2025 Price Master - Escáner avanzado de códigos de barras y QR</span>
          </div>
          <div className="flex items-center space-x-3">
            {['Next.js 15', 'React 19', 'TypeScript', 'ZBar-WASM', 'Quagga2', 'Firebase'].map((tech, idx) => (
              <React.Fragment key={tech}>
                <span className="hover:text-[var(--tab-hover-text)] transition-colors text-[var(--tab-text)]">
                  {tech}
                </span>
                {idx < 5 && <span className="text-[var(--input-border)]">•</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
        {/* Additional footer sections */}
        <div className="mt-4 pt-4 border-t border-[var(--input-border)]">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {sections.map(section => (
              <div key={section.title}>
                <div className="font-semibold mb-2 text-[var(--tab-text)]">{section.title}</div>
                <ul className="space-y-1">
                  {section.items.map((item, idx) => (
                    <li key={idx} className="text-[var(--tab-text)] hover:text-[var(--tab-hover-text)] cursor-pointer transition-colors">{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
