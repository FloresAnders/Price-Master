// app/layout.tsx
import './globals.css';
import { ThemeProvider } from '../components/ThemeProvider';
import Footer from '../components/Footer';

export const metadata = {
  title: 'Price Master',
  description: 'Calcula, cuenta, escanea. Todo en uno.',
  icons: {
    icon: '/favicon.ico',
  },

};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="min-h-full bg-white dark:bg-zinc-900">
      <body className="bg-background text-foreground transition-colors duration-500 min-h-screen flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {/* Header ahora recibe los tabs y control desde el contexto de la página */}
          {children}
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
