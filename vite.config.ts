import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],

  build: {
    // Split heavy vendor libraries into separate cacheable chunks.
    // Using the function form (compatible with both rollup and rolldown APIs).
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react'
          }
          if (id.includes('@hebcal')) {
            return 'hebcal'
          }
          if (id.includes('@supabase')) {
            return 'supabase'
          }
        },
      },
    },
  },
})
