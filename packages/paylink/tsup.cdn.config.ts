import { defineConfig } from 'tsup'

export default defineConfig({
  entry:      { 'palpluss-paylink': 'src/cdn.ts' },
  format:     ['iife'],
  globalName: 'Palpluss',
  minify:     true,
  dts:        false,
  outDir:     'dist/cdn',
  target:     'es2017',
})
