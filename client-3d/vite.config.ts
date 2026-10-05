import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
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
            // without the glTF loader: it stays in the lazy chunk of world/ModelPlacement.tsx,
            // loaded only for a map with models
            {
              name: 'three',
              test: /node_modules[\\/](three(?![\\/]examples[\\/]jsm[\\/]loaders)|@react-three|postprocessing)/,
            },
            { name: 'livekit', test: /node_modules[\\/]livekit-client/ },
          ],
        },
      },
    },
  },
})
