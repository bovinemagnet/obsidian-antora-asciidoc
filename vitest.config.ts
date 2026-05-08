import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    benchmark: {
      include: ['tests/perf/**/*.bench.ts'],
    },
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*View.ts', 'src/main.ts', 'src/settings/SettingsTab.ts', 'src/editor/**'],
    },
  },
  resolve: {
    alias: {
      obsidian: new URL('./tests/stubs/obsidian.ts', import.meta.url).pathname,
    },
  },
});
