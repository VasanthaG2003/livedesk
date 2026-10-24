// Bundles the server into dist/index.js with esbuild.
// npm dependencies stay external (installed on the host as usual); the
// @livedesk/shared workspace is TypeScript source, so it is bundled in.
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const external = Object.keys(pkg.dependencies ?? {}).filter((name) => name !== '@livedesk/shared')

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external,
  logLevel: 'info',
})
