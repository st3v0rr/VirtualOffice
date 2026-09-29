import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // the 2D client runs on 3000, so both can be compared side by side
    port: 3100,
  },
  preview: {
    port: 3100,
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/](three|@react-three|postprocessing)/ },
            { name: 'livekit', test: /node_modules[\\/]livekit-client/ },
          ],
        },
      },
    },
  },
})
