import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  base: '/003生词训练本/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/youdao-api': {
        target: 'http://dict.youdao.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/youdao-api/, ''),
      },
    },
  },
})
