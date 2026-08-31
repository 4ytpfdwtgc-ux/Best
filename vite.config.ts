import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs, so the built app works wherever it is served from:
  // a domain root, a GitHub Pages project subpath (/Best/), or file preview.
  base: './',
  server: { port: 5173 },
})
