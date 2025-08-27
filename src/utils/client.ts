import React from 'react';

// Utility functions for client-side operations to prevent hydration errors

/**
 * Check if code is running on the client side
 */
export const isClientSide = (): boolean => {
  return typeof window !== 'undefined';
};

/**
 * Safe localStorage operations that won't cause hydration errors
 */
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (!isClientSide()) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem: (key: string, value: string): void => {
    if (!isClientSide()) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Fail silently if localStorage is not available
    }
  },

  removeItem: (key: string): void => {
    if (!isClientSide()) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Fail silently if localStorage is not available
    }
  }
};

/**
 * Safe window operations that won't cause hydration errors
 */
export const safeWindow = {
  location: {
    href: (url: string): void => {
      if (!isClientSide()) return;
      window.location.href = url;
    },

    hash: (hash: string): void => {
      if (!isClientSide()) return;
      window.location.hash = hash;
    },

    getHash: (): string => {
      if (!isClientSide()) return '';
      return window.location.hash;
    }
  },

  addEventListener: (event: string, handler: EventListener): void => {
    if (!isClientSide()) return;
    window.addEventListener(event, handler);
  },

  removeEventListener: (event: string, handler: EventListener): void => {
    if (!isClientSide()) return;
    window.removeEventListener(event, handler);
  }
};

/**
 * Custom hook for client-side mounting detection
 */
export const useClientMounted = (): boolean => {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  return isMounted;
};
