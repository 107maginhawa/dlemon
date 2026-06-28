/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone app (not in the monorepo workspaces); pin the tracing root to
  // this dir so Next stops inferring the parent repo and its lockfile.
  outputFileTracingRoot: import.meta.dirname,
  compiler: {
    // Strip console.log in production; keep error/warn/info for debugging.
    removeConsole: { exclude: ['error', 'warn', 'info'] },
  },
}

export default nextConfig
