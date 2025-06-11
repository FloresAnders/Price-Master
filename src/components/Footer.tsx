// src/components/Footer.tsx
'use client';

import React from 'react';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm">
          <div className="text-center sm:text-left">
            <span>© 2025 Price Master - Herramientas para el manejo de precios</span>
          </div>
          <div className="flex items-center space-x-4">
            {['Next.js 15', 'React 19', 'Tailwind CSS'].map((tech, idx) => (
              <React.Fragment key={tech}>
                <span className="hover:text-[var(--tab-hover-text)] transition-colors text-[var(--tab-text)]">
                  {tech}
                </span>
                {idx < 2 && <span className="text-[var(--input-border)]">•</span>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Additional footer sections */}
        <div className="mt-6 pt-6 border-t border-[var(--input-border)]">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { title: 'Productos', items: ['Análisis de Precios', 'Optimización', 'Competencia', 'Reportes'] },
              { title: 'Empresa', items: ['Acerca de', 'Equipo', 'Carreras', 'Contacto'] },
              { title: 'Recursos', items: ['Blog', 'Documentación', 'API', 'Tutoriales'] },
              { title: 'Soporte', items: ['Centro de Ayuda', 'Estado del Sistema', 'Términos de Uso', 'Privacidad'] },
            ].map(section => (
              <div key={section.title}>
                <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">{section.title}</h3>
                <ul className="space-y-2 text-sm">
                  {section.items.map(item => (
                    <li key={item}>
                      <a href="#" className="hover:text-[var(--tab-hover-text)] transition-colors text-[var(--tab-text)]">
                        {item}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Social links and additional info */}
        <div className="mt-6 pt-6 border-t border-[var(--input-border)]">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex space-x-6">
              {[
                { label: 'Twitter', svg: (<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.29..." /></svg>) },
                { label: 'LinkedIn', svg: (<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.338..." clipRule="evenodd" /></svg>) },
                { label: 'GitHub', svg: (<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 0..." clipRule="evenodd" /></svg>) },
              ].map(link => (
                <a key={link.label} href="#" className="hover:text-[var(--tab-hover-text)] transition-colors text-[var(--tab-text)]" aria-label={link.label}>
                  {link.svg}
                  <span className="sr-only">{link.label}</span>
                </a>
              ))}
            </div>
            <div className="text-xs text-[var(--tab-text)]">Hecho con ❤️ en Costa Rica</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
