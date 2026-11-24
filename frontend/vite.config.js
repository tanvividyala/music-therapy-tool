import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base must match the GitHub Pages path: https://<user>.github.io/music-therapy-tool/
export default defineConfig({
  plugins: [react()],
  base: '/music-therapy-tool/',
  // Spotify only allows loopback IPs (not "localhost") as http redirect URIs.
  server: { host: '127.0.0.1', port: 5173 },
  test: { environment: 'node' },
})
