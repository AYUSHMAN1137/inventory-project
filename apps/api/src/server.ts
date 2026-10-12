import 'dotenv/config';
import { app, appConfig } from './app.js';
import { logger } from './logger.js';
import { prisma } from './db.js';

const PORT = appConfig.PORT;

const server = app.listen(PORT, () => {
  logger.info('api server listening', { port: PORT, env: appConfig.NODE_ENV });
});

/**
 * Graceful shutdown: stop accepting connections, drain the database pool, then
 * exit. Without this a container restart can cut an in-flight request or leave
 * a Prisma connection half-open.
 */
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('shutting down', { signal });

  const forceExit = setTimeout(() => {
    logger.error('graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async (err) => {
    clearTimeout(forceExit);
    if (err) {
      logger.error('error while closing server', { error: err.message });
    }
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      logger.error('error disconnecting database', {
        error: disconnectError instanceof Error ? disconnectError.message : String(disconnectError),
      });
    }
    process.exit(err ? 1 : 0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Never let an unhandled rejection or exception take the process down
// silently — log it and shut down cleanly so the process manager can restart.
process.on('unhandledRejection', (reason) => {
  logger.error('unhandled promise rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  void shutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  logger.error('uncaught exception', { error: error.message, stack: error.stack });
  void shutdown('uncaughtException');
});
