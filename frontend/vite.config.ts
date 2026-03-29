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
    hmr: {
      overlay: false,
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
