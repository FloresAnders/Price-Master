// app/layout.tsx 
import './globals.css';
import { ThemeProvider } from '../components/ThemeProvider';
import HeaderWrapper from '../components/HeaderWrapper';
import Footer from '../components/Footer';
import AuthWrapper from '../components/AuthWrapper';

export const metadata = {
  title: 'Price Master',
  description: 'Plataforma para gestión de precios, escaneo de códigos de barras, control de inventario y horarios laborales',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' }
    ],
    apple: '/apple-touch-icon.png',
    other: [
      {
        rel: 'android-chrome-192x192',
        url: '/android-chrome-192x192.png',
      },
      {
        rel: 'android-chrome-512x512',
        url: '/android-chrome-512x512.png',
      },
    ],
  },
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Price Master',
  },
  verification: {
    google: '9TNvqvQrFhVHvPtQR01Du1GhCiG1yjPPvCgJTGf09w0',
  },
  authors: [
    { name: 'AndersFloresM' },
    { name: 'AlvaroChavesC' }
  ],
  creator: 'AndersFloresM',
  robots: 'index, follow',
  generator: 'Next.js',
  applicationName: 'Price Master',
  keywords: ['price master', 'calculadora', 'contador', 'escaner', 'precio', 'codigo barras', 'horarios laborales', 'inventario'],
  category: 'business',
  other: {
    copyright: '2025 Price Master - AndersFloresM & AlvaroChavesC',
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#2563eb',
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563eb',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="min-h-full bg-white dark:bg-zinc-900">
      <body className="bg-background text-foreground transition-colors duration-500 min-h-screen flex flex-col" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthWrapper>
            <HeaderWrapper />
            <main className="flex-1 flex flex-col w-full">
              <div className="w-full" suppressHydrationWarning>
                {children}
              </div>
            </main>
            <Footer />
          </AuthWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
