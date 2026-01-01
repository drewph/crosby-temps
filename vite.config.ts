import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/crosby-temps/',
  test: {
    environment: 'node'
  }
});
