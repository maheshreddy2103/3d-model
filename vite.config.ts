import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths so the built site works from any folder or sub-path on a static host.
  base: './',
  plugins: [react()],
  build: {
    // Vendor libraries in their own cacheable chunks; three.js alone is ~700 kB minified.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          charts: ['recharts'],
          react: ['react', 'react-dom', 'zustand'],
        },
      },
    },
  },
  // Pre-bundle at startup so the first page load doesn't trigger a re-optimise and reload.
  optimizeDeps: {
    include: [
      'react', 'react-dom/client', 'react/jsx-dev-runtime', 'three',
      '@react-three/fiber', '@react-three/drei', 'zustand', 'recharts',
    ],
  },
});
