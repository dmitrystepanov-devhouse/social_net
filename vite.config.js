import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Project is served from https://<user>.github.io/social_net/
  base: '/social_net/',
  plugins: [react()],
})
