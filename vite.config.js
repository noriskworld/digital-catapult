import { defineConfig } from 'vite';

/**
 * Two build targets:
 *
 *   npm run build             standard multi-file build for a web server
 *   npm run build:standalone  one self-contained .html that also works from
 *                             file:// - see scripts/build-standalone.mjs
 *
 * The standalone target must not emit ES modules: browsers block module
 * scripts loaded over file:// as a cross-origin request, so a double-clicked
 * page would silently do nothing. An IIFE bundle has no such restriction.
 */
export default defineConfig(({ mode }) => ({
  base: './',
  build: mode === 'standalone'
    ? {
        outDir: 'dist-standalone',
        assetsDir: '.',
        cssCodeSplit: false,
        modulePreload: false,
        rollupOptions: {
          output: {
            format: 'iife',
            inlineDynamicImports: true,
            entryFileNames: 'app.js',
            assetFileNames: 'app.[ext]'
          }
        }
      }
    : {}
}));
