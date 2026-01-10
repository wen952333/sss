import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.', // Ensure root is current directory (frontend)
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});