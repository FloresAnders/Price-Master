// app/layout.tsx 
import './globals.css';
import { ThemeProvider } from '../components/ThemeProvider';
import HeaderWrapper from '../components/HeaderWrapper';
import Footer from '../components/Footer';

export const metadata = {
  title: 'Price Master',
  description: 'Calcula, cuenta, escanea. Todo en uno.',
  icons: {
    icon: '/favicon.ico',
  },
  verification: {
    google: '9TNvqvQrFhVHvPtQR01Du1GhCiG1yjPPvCgJTGf09w0',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="min-h-full bg-white dark:bg-zinc-900">
      <head>
        <meta name="author" content="AndersFloresM, AlvaroChavesC" />
        <meta name="creator" content="AndersFloresM" />
        <meta name="creator" content="AlvaroChavesC" />
        <meta name="copyright" content="2025 Price Master - AndersFloresM & AlvaroChavesC" />
        <meta name="robots" content="index, follow" />
        <meta name="generator" content="Next.js" />
        <meta name="application-name" content="Price Master" />
        <meta name="keywords" content="price master, calculadora, contador, escaner, precio, codigo barras" />
      </head>
      <body className="bg-background text-foreground transition-colors duration-500 min-h-screen flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <HeaderWrapper />
          <main className="flex-1 flex flex-col w-full">
            <div className="w-full">
              {children}
            </div>
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
