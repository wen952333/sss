import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Polyfill process.env for the Google GenAI SDK usage in client
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // If you are using Cloudflare Pages environment variables, 
      // they are injected at build time if prefixed with VITE_ or handled here.
      // Note: Exposing API keys in client-side code is generally not recommended for production.
      'process.env': process.env
    }
  }
})