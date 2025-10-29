import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    css: false,
    globals: true,
    mockReset: true
  },
  build: {
    rollupOptions: {
      input: {
        popup: 'index.html'
      }
    },
    outDir: '../build/popup',
    emptyOutDir: true
  }
});
