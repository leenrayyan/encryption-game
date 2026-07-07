import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Expose VITE_* vars (standard) plus the raw Firebase config field names, so
  // pasting Firebase's config values into Netlify as-is (apiKey, databaseURL, …)
  // also works. These are public client keys, safe to embed.
  envPrefix: [
    'VITE_',
    'apiKey',
    'authDomain',
    'databaseURL',
    'projectId',
    'appId',
  ],
  server: {
    host: true, // expose on LAN so phones on the same network can reach dev server
  },
})
