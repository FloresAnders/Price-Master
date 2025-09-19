import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['firebase/app', 'firebase/firestore', 'firebase/storage']
  },
  server: {
    port: 3000,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1000, // Aumentar el límite a 1MB
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Separar vendor libraries
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('quagga2') || id.includes('zbar-wasm') || id.includes('zxing')) {
              return 'vendor-scanner';
            }
            if (id.includes('framer-motion') || id.includes('lucide-react')) {
              return 'vendor-ui';
            }
            if (id.includes('html2canvas') || id.includes('qrcode') || id.includes('lz-string')) {
              return 'vendor-utils';
            }
            return 'vendor-other';
          }
          
          // Separar código de la aplicación por módulos
          if (id.includes('/src/components/scanner/')) {
            return 'app-scanner';
          }
          if (id.includes('/src/components/business/')) {
            return 'app-business';
          }
          if (id.includes('/src/components/admin/')) {
            return 'app-admin';
          }
          if (id.includes('/src/services/')) {
            return 'app-services';
          }
        }
      }
    }
  }
})