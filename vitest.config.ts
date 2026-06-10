import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/sim/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
