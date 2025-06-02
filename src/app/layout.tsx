// app/layout.tsx
import './globals.css';
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Price Master',
  description: 'Calcula, cuenta, escanea. Todo en uno.',
  icons: {
    icon: '@/favicon.ico',
  },
  // Removed viewport and themeColor from metadata
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className={`${inter.className} min-h-screen`}>
            <main>{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
