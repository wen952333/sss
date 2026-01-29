
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Polyfill process.env for the @google/genai library usage pattern
    'process.env': process.env
  }
});
