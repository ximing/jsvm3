import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  esbuild: {
    jsx: 'preserve',
  },
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
  define: {
    'process.env': {},
  },
  optimizeDeps: {
    include: [
      '@babel/parser',
      '@babel/types',
      'jsvm3/lib/compiler/emitter.js',
      'jsvm3/lib/vm/vm.js',
    ],
  },
  ssr: {
    noExternal: ['jsvm3'],
  },
})