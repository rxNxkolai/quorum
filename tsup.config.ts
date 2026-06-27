import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  target: 'node18',
  dts: { entry: 'src/index.ts' },
  clean: true,
  sourcemap: true,
  splitting: false,
  minify: false,
});
