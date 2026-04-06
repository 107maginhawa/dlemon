/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@monobase/ui', '@monobase/sdk'],
  compiler: {
    // Remove console.log in production, keep console.error/warn for debugging
    removeConsole: {
      exclude: ['error', 'warn', 'info'],
    },
  },
}

export default nextConfig
