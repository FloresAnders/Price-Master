// app/layout.tsx
import './globals.css';
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Price Master',
  description: 'Descripción de tu app',
  icons: {
    icon: '/barcode.ico',
  },
  // Removed viewport and themeColor from metadata
};

// Generar la etiqueta <meta name="viewport">
export function generateViewport(): string {
  return 'width=device-width, initial-scale=1';
}

// Generar la etiqueta <meta name="theme-color">
export function generateThemeColor() {
  return [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ];
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className={`${inter.className} min-h-screen`}>
            <main>
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
