// src/components/Footer.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Footer() {
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const router = useRouter();

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isGitHubModalOpen) {
        setIsGitHubModalOpen(false);
      }
    };

    if (isGitHubModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isGitHubModalOpen]);
  
  return (
    <footer className="mt-auto border-t border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)]">
      <div className="max-w-7xl mx-auto px-4 py-4" suppressHydrationWarning>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4" suppressHydrationWarning>
          <div className="text-center sm:text-left" suppressHydrationWarning>
            <span className="text-sm text-[var(--tab-text)]">© {new Date().getFullYear()} Price Master</span>
          </div>
          <div className="flex items-center space-x-4" suppressHydrationWarning>
            <button
              onClick={() => setIsGitHubModalOpen(true)}
              className="flex items-center space-x-2 hover:text-[var(--tab-hover-text)] transition-colors text-[var(--tab-text)]"
              aria-label="GitHub"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">Equipo</span>
            </button>
            <button
              onClick={() => router.push('/login')}
              className="flex items-center space-x-2 hover:text-[var(--tab-hover-text)] transition-colors text-[var(--tab-text)] opacity-50 hover:opacity-100"
              aria-label="Mmmm"
              title="Mmmm"
            >
              <span className="text-lg">ㅤㅤ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal de GitHub */}
      {isGitHubModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" suppressHydrationWarning>
          <div className="bg-[var(--card-bg)] rounded-2xl shadow-xl w-full max-w-md p-6 relative border border-[var(--input-border)]" suppressHydrationWarning>
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
                <p className="text-[var(--tab-text)] mb-6">Conoce más sobre los desarrolladores del proyecto</p>
              </div>

              <div className="space-y-4">
                <a
                  href="https://github.com/FloresAnders/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-3 p-3 bg-[var(--input-bg)] hover:bg-[var(--input-border)] rounded-lg transition-colors cursor-pointer"
                  onClick={() => setIsGitHubModalOpen(false)}
                >
                  <svg className="w-5 h-5 text-[var(--foreground)]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[var(--foreground)] font-medium">Anders Flores M</span>
                </a>

                <a
                  href="https://github.com/alchacas1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-3 p-3 bg-[var(--input-bg)] hover:bg-[var(--input-border)] rounded-lg transition-colors cursor-pointer"
                  onClick={() => setIsGitHubModalOpen(false)}
                >
                  <svg className="w-5 h-5 text-[var(--foreground)]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[var(--foreground)] font-medium">Alvaro Chaves C</span>
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
