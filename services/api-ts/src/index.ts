/**
 * API service entry point
 * Parses configuration and starts the server with proper dependency management
 *
 * Exports createApp and parseConfig for Boa bundle builds.
 */

import { createApp, initializeApp, cleanupApp } from '@/app';
import { parseConfig } from '@/core/config';

// Export for Boa bundle + tests (importing these must be side-effect-free).
export { createApp, parseConfig };

// Bootstrap the live server ONLY when this module is the entry point
// (`bun src/index.ts`). Importing `{ createApp, parseConfig }` from this module
// — as the test suite and the Boa/QuickJS bundle do — must NOT run migrations,
// initialize templates, or bind a port. Without this guard every test that
// imports `@/index` would run `initializeApp` (DB writes) and `Bun.serve`
// (port 7213) on import, causing cross-file pollution and port collisions
// under the parallel per-file test runner.
if (import.meta.main) {
  // Parse configuration from CLI args and environment
  const config = parseConfig();

  // Create application with all dependencies
  const app = createApp(config);
  const log = app.logger.child({ module: 'main' });

  // Initialize all application components
  try {
    await initializeApp(app, config);
  } catch (error) {
    log.error({ error }, 'Failed to initialize application');
    process.exit(1);
  }

  // Handle graceful shutdown
  let isShuttingDown = false;

  const handleShutdown = async (signal: string) => {
    if (isShuttingDown) {
      return; // Already shutting down, ignore duplicate signals
    }

    isShuttingDown = true;
    log.info(`${signal} received, shutting down gracefully...`);

    try {
      await cleanupApp(app);
      log.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      log.error({ error }, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  // Register signal handlers using process.once to ensure single execution
  process.once('SIGTERM', () => handleShutdown('SIGTERM'));
  process.once('SIGINT', () => handleShutdown('SIGINT'));

  // Start the server with Bun.serve
  const server = Bun.serve({
    hostname: config.server.host,
    port: config.server.port,
    fetch: app.fetch,
    websocket: app.ws.websocket, // Hono's WebSocket handler
  });

  log.info(`🚀 Server running on http://${server.hostname}:${server.port}`);
}
