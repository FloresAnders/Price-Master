// app/layout.tsx 
import './globals.css';
import { ThemeProvider } from '../components/ThemeProvider';
import Header from '../components/Header';
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
      <body className="bg-background text-foreground transition-colors duration-500 min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Header />
          <main className="flex-1 flex flex-col items-center justify-center w-full">
            <div className="w-full max-w-6xl px-4">
              {children}
            </div>
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
