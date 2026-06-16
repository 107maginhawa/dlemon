import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  server: {
    port: 3003,
  },
  plugins: [
    tsConfigPaths({
      ignoreConfigErrors: true
    }),
    tanstackRouter({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      routeFileIgnorePattern: '(\\.test\\.(ts|tsx)|imaging(-comparison)?-test\\.tsx?)$',
      // Build-time code-splitting: each route's component is emitted as its own
      // chunk, loaded on navigation instead of in the main entry bundle — the
      // big LCP/TBT win. Pure build transform of route files; unit tests import
      // components directly so they are unaffected.
      autoCodeSplitting: true,
    }),
    viteReact(),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Isolate the heavy, occasional-use libraries into their own cacheable
        // chunks so they (a) don't bloat the main entry chunk and (b) can be
        // fetched in parallel / cached independently across app updates. (The
        // larger win — not shipping these on screens that never use them — needs
        // dynamic import() of their host components; deferred pending a runtime
        // perf measurement, see the audit tracker Batch 8.)
        manualChunks: {
          'vendor-tzdb': ['@vvo/tzdb'],
          'vendor-geo': ['country-list', '@cospired/i18n-iso-languages', 'iso-639-1'],
          'vendor-cropper': ['react-easy-crop'],
          'vendor-swiper': ['swiper'],
          'vendor-phone': ['react-phone-number-input'],
        },
      },
    },
  },
  esbuild: {
    // Mark console.log as side-effect-free so the bundler can drop it in
    // production while keeping console.error/warn/info intact.
    pure: ['console.log'],
  },
})
