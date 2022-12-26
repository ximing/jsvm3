import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'classic',
    }),
  ],
  base: '/jsvm3/',
  build: {
    outDir: 'dist',
    commonjsOptions: {
      include: [/lib/, /node_modules/],
    },
  },
  resolve: {
    alias: {
      'jsvm3': path.resolve(__dirname, '..'),
    },
  },
  optimizeDeps: {
    include: [
      '@babel/parser',
      '@babel/types',
    ],
  },
  ssr: {
    noExternal: ['jsvm3'],
  },
})