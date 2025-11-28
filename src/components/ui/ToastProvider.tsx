"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';
type Toast = { id: string; message: string; type: ToastType };

type ToastContextValue = {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export const useInternalToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useInternalToast must be used within ToastProvider');
  return ctx;
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const toast: Toast = { id, message, type };
    setToasts(prev => [toast, ...prev]);
    window.setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast container (top-right) */}
      <div className="fixed top-4 right-4 z-50 flex flex-col items-end space-y-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`max-w-sm w-full shadow-lg rounded-md px-4 py-2 flex items-start gap-3 transition-all ${t.type === 'success' ? 'bg-green-600 text-white' : t.type === 'warning' ? 'bg-yellow-500 text-white' : 'bg-white dark:bg-zinc-800 text-foreground'
              }`}
            role="status"
            aria-live={t.type === 'error' ? 'assertive' : 'polite'}
          >
            <div className={`pt-1`}>
              {t.type === 'success' && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              )}
              {t.type === 'error' && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              )}
              {t.type === 'info' && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" /></svg>
              )}
              {t.type === 'warning' && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86l-8.66 15A1 1 0 002.5 20h19a1 1 0 00.87-1.5l-8.66-15a1 1 0 00-1.72 0z" /></svg>
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm">{t.message}</div>
            </div>
            <button aria-label="Cerrar" onClick={() => removeToast(t.id)} className={`text-sm opacity-60 hover:opacity-90 ml-2 ${t.type === 'success' || t.type === 'warning' ? 'text-white' : ''}`}>✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
