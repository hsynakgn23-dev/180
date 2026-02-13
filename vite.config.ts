import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isAnalyzeMode = mode === 'analyze' || process.env.ANALYZE === '1'

  return {
    plugins: [
      react(),
      ...(isAnalyzeMode
        ? [
            visualizer({
              filename: 'dist/bundle-analysis.html',
              template: 'treemap',
              gzipSize: true,
              brotliSize: true,
              emitFile: true,
              open: false,
            }),
          ]
        : []),
    ],
  }
})
