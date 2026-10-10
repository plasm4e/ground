import { defineConfig } from 'vitest/config';

// Unit tests for pure logic (reducers, selectors). Screens are exercised by running the app.
export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
