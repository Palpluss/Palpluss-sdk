import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry:    { index: 'src/index.ts' },
    format:   ['cjs', 'esm'],
    dts:      true,
    clean:    true,
    external: ['react', 'react-dom'],
  },
  {
    entry:    { react: 'src/react.tsx' },
    format:   ['cjs', 'esm'],
    dts:      true,
    external: ['react', 'react-dom'],
  },
])
