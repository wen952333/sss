import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  // Cloudflare Pages建议base用'/'，这样 assets 路径不会错
  base: '/',
});
