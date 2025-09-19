import { Routes, Route } from 'react-router-dom'
import { ThemeProvider, HeaderWrapper, Footer } from './components/layout'
import { AuthWrapper } from './components/auth'

// Import pages
import HomePage from './pages/HomePage'
import MobileScanPage from './pages/MobileScanPage'
import MobileScanCodePage from './pages/MobileScanCodePage'
import FirebaseTestPage from './pages/FirebaseTestPage'

function App() {
  return (
    <html lang="es" suppressHydrationWarning className="min-h-full bg-white dark:bg-zinc-900">
      <body className="bg-background text-foreground transition-colors duration-500 min-h-screen flex flex-col" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthWrapper>
            <HeaderWrapper />
            <main className="flex-1 flex flex-col w-full">
              <div className="w-full" suppressHydrationWarning>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/mobile-scan" element={<MobileScanPage />} />
                  <Route path="/mobile-scan/:code" element={<MobileScanCodePage />} />
                  <Route path="/firebase-test" element={<FirebaseTestPage />} />
                </Routes>
              </div>
            </main>
            <Footer />
          </AuthWrapper>
        </ThemeProvider>
      </body>
    </html>
  )
}

export default App