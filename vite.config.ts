import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 强制加载环境变量（即使在 Cloudflare 构建环境中）
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // 将 API_KEY 和 BOT_USERNAME 硬编码注入到客户端代码中
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // 定义全局常量 __BOT_USERNAME__，优先使用 VITE_BOT_USERNAME，其次尝试 BOT_USERNAME
      '__BOT_USERNAME__': JSON.stringify(env.VITE_BOT_USERNAME || env.BOT_USERNAME || ""),
      '__BOT_APP_SHORT_NAME__': JSON.stringify(env.VITE_BOT_APP_SHORT_NAME || "app"),
      'process.env': process.env
    }
  }
})