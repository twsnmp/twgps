import {defineConfig} from 'vite'
import {svelte} from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    port: Number(process.env.VITE_PORT || process.env.PORT) || 5173,
    strictPort: false,
  }
})

