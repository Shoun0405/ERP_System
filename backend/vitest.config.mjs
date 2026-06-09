import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals:       true,
    environment:   'node',
    globalSetup:   './tests/global-setup.mjs',
    setupFiles:    ['./tests/env-setup.mjs'],
    testTimeout:   20000,
    pool:          'forks',
    fileParallelism: false,
    forks:         { singleFork: true },
    include:       ['tests/**/*.test.mjs', 'lib/**/*.test.js', 'routes/**/*.test.js'],
  },
});
