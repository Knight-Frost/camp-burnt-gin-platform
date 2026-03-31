import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Allow triple-slash reference to vitest globals (test, expect, describe, vi)
/// <reference types="vitest" />

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/api': path.resolve(__dirname, './src/api'),
      '@/core': path.resolve(__dirname, './src/core'),
      '@/ui': path.resolve(__dirname, './src/ui'),
      '@/features': path.resolve(__dirname, './src/features'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/store': path.resolve(__dirname, './src/store'),
      '@/assets': path.resolve(__dirname, './src/assets'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-redux': ['@reduxjs/toolkit', 'react-redux'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-accordion',
            '@radix-ui/react-select',
            '@radix-ui/react-dropdown-menu',
          ],
          'vendor-motion': ['framer-motion'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
    // Source maps expose original TypeScript in browser DevTools.
    // Enable only in development; never ship to production.
    sourcemap: process.env.NODE_ENV !== 'production',
  },
  server: {
    port: 5173,
    strictPort: true,
    // Bind to all interfaces so the dev server is reachable via LAN IP,
    // not just localhost. Required for remote/mobile device testing.
    host: true,
    hmr: {
      // HMR must use the client port (5173) explicitly when accessed via LAN IP,
      // otherwise the browser tries to open a WebSocket to an internal address.
      clientPort: 5173,
      overlay: false,
    },
    proxy: {
      // Forward all /api/* requests from the browser to the Laravel backend.
      // The proxy runs server-side (machine → machine), so the browser always
      // sends requests to the Vite origin regardless of whether it connected via
      // localhost or a LAN IP. This eliminates CORS entirely in development and
      // ensures the correct backend is reached in both scenarios.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        // Fail fast if the backend is unresponsive — prevents indefinite hangs
        // when php artisan serve is slow or not yet running. Without these,
        // a single stuck request blocks the browser connection indefinitely,
        // triggering useAuthInit's 20-second retry cascade.
        timeout: 10000,
        proxyTimeout: 10000,
      },
    },
  },
  // ─── Vitest ──────────────────────────────────────────────────────────────────
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    globals: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'clover'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/__tests__/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
    },
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@reduxjs/toolkit',
      'react-redux',
      'redux-persist',
      'framer-motion',
    ],
  },
});
