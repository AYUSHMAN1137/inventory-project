import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
    },
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    hookTimeout: 60000,
    testTimeout: 30000,
    sequence: { concurrent: false },
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/test/**'],
    },
  },
});
