// src/components/Footer.tsx
'use client';

import React from 'react';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-xs">
          <div className="text-center sm:text-left">
            <span>© 2025 Price Master</span>
          </div>
          <div className="flex items-center space-x-2">
            {['Next.js 15', 'React 19', 'TypeScript', 'Firebase'].map((tech, idx) => (
              <React.Fragment key={tech}>
                <span className="hover:text-[var(--tab-hover-text)] transition-colors text-[var(--tab-text)]">
                  {tech}
                </span>
                {idx < 3 && <span className="text-[var(--input-border)]">•</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
