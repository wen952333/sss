import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 本地开发时，所有 /api.php 请求转发到远端后端
      '/api.php': {
        target: 'https://9526.ip-ddns.com',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
