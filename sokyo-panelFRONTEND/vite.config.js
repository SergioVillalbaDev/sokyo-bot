import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { prerenderPortada } from './scripts/prerender-portada.js'

// https://vite.dev/config/
// prerenderPortada: mete la portada ya pintada en dist/index.html (ver el archivo).
export default defineConfig({
  plugins: [react(), tailwindcss(), prerenderPortada()],
})
