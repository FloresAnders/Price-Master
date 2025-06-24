// src/components/Footer.tsx
'use client';

import React, { useState } from 'react';

export default function Footer() {
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  
  const sections = [
    { title: 'Productos', items: ['Escáner de Códigos', 'Cámara en Vivo', 'Detección Multi-formato', 'Análisis ZBar-WASM'] },
    { title: 'Empresa', items: ['Acerca de', 'Equipo', 'Carreras', 'Contacto'] },
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
        </div>        {/* Additional footer sections */}
        <div className="mt-6 pt-6 border-t border-[var(--input-border)]">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { title: 'Productos', items: ['Escáner de Códigos', 'Cámara en Vivo', 'Detección Multi-formato', 'Análisis ZBar-WASM'] },
              {
                title: 'Empresa',
                items: [
                  'Acerca de',
                  { name: 'Equipo', action: () => setIsGitHubModalOpen(true) },
                  'Carreras',
                  'Contacto'
                ]
              },
              { title: 'Tecnologías', items: ['Next.js 15', 'React 19', 'TypeScript', 'Firebase'] },
              { title: 'Soporte', items: ['Centro de Ayuda', 'Documentación API', 'Términos de Uso', 'Privacidad'] },
            ].map(section => (
              <div key={section.title}>
                <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">{section.title}</h3>                <ul className="space-y-2 text-sm">
                  {section.items.map((item) => (
                    <li key={typeof item === 'string' ? item : item.name}>
                      {typeof item === 'string' ? (
                        <a href="#" className="hover:text-[var(--tab-hover-text)] transition-colors text-[var(--tab-text)]">
                          {item}
                        </a>
                      ) : (
                        <button
                          onClick={item.action}
                          className="hover:text-[var(--tab-hover-text)] transition-colors text-[var(--tab-text)] text-left"
                        >
                          {item.name}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>        {/* Social links and additional info */}
        <div className="mt-6 pt-6 border-t border-[var(--input-border)]">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex space-x-6">
              {[
                {
                  label: 'GitHub',
                  svg: (<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" /></svg>),
                  action: () => setIsGitHubModalOpen(true)
                },
                {
                  label: 'Documentación',
                  svg: (<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h6a1 1 0 001-1V3a2 2 0 012 2v6.5a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 100 2h6a1 1 0 100-2H7zm0 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>),
                  href: '#'
                },
                {
                  label: 'Firebase',
                  svg: (<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path d="M3.5 3.5l2.83 5.18L8.5 3.5l5 9 2.5-4.5-1 2.5L18.5 18l-7-3.5L3.5 18l-1-14.5z" /></svg>),
                  href: '#'
                },
              ].map(link => (
                <React.Fragment key={link.label}>
                  {link.action ? (
                    <button
                      onClick={link.action}
                      className="hover:text-[var(--tab-hover-text)] transition-colors text-[var(--tab-text)]"
                      aria-label={link.label}
                    >
                      {link.svg}
                      <span className="sr-only">{link.label}</span>
                    </button>
                  ) : (
                    <a
                      href={link.href}
                      className="hover:text-[var(--tab-hover-text)] transition-colors text-[var(--tab-text)]"
                      aria-label={link.label}
                    >
                      {link.svg}
                      <span className="sr-only">{link.label}</span>
                    </a>
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="text-xs text-[var(--tab-text)]">Desarrollado con ❤️ usando tecnologías modernas</div>
          </div>
        </div>
      </div>

      {/* Modal de GitHub */}
      {isGitHubModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] rounded-2xl shadow-xl w-full max-w-md p-6 relative border border-[var(--input-border)]">
            <button
              className="absolute top-4 right-4 text-[var(--foreground)] hover:text-gray-500 transition-colors"
              onClick={() => setIsGitHubModalOpen(false)}
              aria-label="Cerrar modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center">
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto text-[var(--foreground)] mb-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
                </svg>
                <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">Equipo de Desarrollo</h2>
                <p className="text-[var(--tab-text)] mb-6">Conoce más sobre el desarrollador principal del proyecto</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-3 p-3 bg-[var(--input-bg)] rounded-lg">
                  <svg className="w-5 h-5 text-[var(--foreground)]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[var(--foreground)] font-medium">FloresAnders</span>
                </div>

                <a
                  href="https://github.com/FloresAnders/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-gray-900 hover:bg-gray-800 text-white rounded-lg py-3 px-4 transition-colors duration-200 font-medium"
                  onClick={() => setIsGitHubModalOpen(false)}
                >
                  Visitar Perfil de GitHub
                </a>

                <button
                  onClick={() => setIsGitHubModalOpen(false)}
                  className="w-full bg-[var(--input-bg)] hover:bg-[var(--input-border)] text-[var(--foreground)] rounded-lg py-2 px-4 transition-colors duration-200"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
