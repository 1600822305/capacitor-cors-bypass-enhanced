export default [
  // ES Module build
  {
    input: 'dist/esm/index.js',
    external: ['@capacitor/core'],
    output: {
      file: 'dist/plugin.mjs',
      format: 'es',
      sourcemap: true,
      inlineDynamicImports: true,
    },
  },
  // CommonJS build
  {
    input: 'dist/esm/index.js',
    external: ['@capacitor/core'],
    output: {
      file: 'dist/plugin.cjs.js',
      format: 'cjs',
      sourcemap: true,
      inlineDynamicImports: true,
    },
  },
  // IIFE build for browsers
  {
    input: 'dist/esm/index.js',
    external: ['@capacitor/core'],
    output: {
      file: 'dist/plugin.js',
      format: 'iife',
      name: 'capacitorCorsProxy',
      globals: {
        '@capacitor/core': 'capacitorExports',
      },
      sourcemap: true,
      inlineDynamicImports: true,
    },
  },
];
