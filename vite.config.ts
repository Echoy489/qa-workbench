/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-extension-files',
      closeBundle() {
        // Copy manifest
        copyFileSync('manifest.json', 'dist/manifest.json')
        // Copy icons
        if (existsSync('public/icons')) {
          mkdirSync('dist/icons', { recursive: true })
          for (const f of readdirSync('public/icons')) {
            copyFileSync(`public/icons/${f}`, `dist/icons/${f}`)
          }
        }
      },
    },
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'sidepanel.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'background.js'
          if (chunk.name === 'content') return 'content.js'
          return 'assets/[name]-[hash].js'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
