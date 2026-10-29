import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
        'src/main.ts',
        'src/**/*.module.ts',
        'src/migrations/**',
        'src/database/cli.data-source.ts',
        'src/scripts/**',
        'src/test-setup.ts',
        'src/test-matchers.ts',
        'src/**/*.fixture.ts',
      ],
      reportsDirectory: 'coverage',
      reporter: ['text-summary', 'lcov', 'json-summary'],
      thresholds: {
        statements: 98,
        branches: 90,
        functions: 98,
        lines: 98,
      },
    },
  },
});
