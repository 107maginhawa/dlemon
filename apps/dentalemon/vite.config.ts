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
    }),
    viteReact(),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    minify: 'esbuild',
  },
  esbuild: {
    // Mark console.log as side-effect-free so the bundler can drop it in
    // production while keeping console.error/warn/info intact.
    pure: ['console.log'],
  },
})
