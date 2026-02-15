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
    build: {
      chunkSizeWarningLimit: 550,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/')

            if (normalizedId.includes('node_modules')) {
              if (normalizedId.includes('/react/')) return 'vendor-react'
              if (normalizedId.includes('/react-dom/')) return 'vendor-react'
              if (normalizedId.includes('/@supabase/')) return 'vendor-supabase'
              return 'vendor'
            }

            if (normalizedId.includes('/src/features/profile/')) return 'feature-profile'
            if (normalizedId.includes('/src/features/arena/')) return 'feature-arena'
            if (normalizedId.includes('/src/features/daily-showcase/')) return 'feature-daily'
            if (normalizedId.includes('/src/context/XPContext.tsx')) return 'core-xp'
          },
        },
      },
    },
  }
})
