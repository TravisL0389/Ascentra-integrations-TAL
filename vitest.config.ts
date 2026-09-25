import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    // Deno requires explicit ".ts" imports from _shared; vite/vitest resolve
    // them natively, so no alias needed.
  },
});