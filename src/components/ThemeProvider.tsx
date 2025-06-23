'use client';
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'
import { ReactNode } from 'react'

export function ThemeProvider({ children, ...props }: ThemeProviderProps & { children: ReactNode }) {
  return (
    <NextThemesProvider
      {...props}
      attribute="class"
      enableColorScheme={false}    // <— desactiva el style="color-scheme" automático
    >
      {children}
    </NextThemesProvider>
  )
}
