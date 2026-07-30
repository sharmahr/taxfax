import { build, context } from 'esbuild';

/**
 * Functions are bundled rather than tsc-compiled for two reasons: the shared
 * domain package is consumed as source (one source of truth, no publish step),
 * and a single bundled file measurably improves cold start.
 */
const options = {
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  minify: false,
  // Kept as real dependencies so the Functions deploy analyser can find them.
  external: ['firebase-admin', 'firebase-functions'],
  banner: {
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
  },
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
