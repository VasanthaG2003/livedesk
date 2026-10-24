// Bundles the server into dist/index.js with esbuild.
// Every npm package stays external (installed on the host as usual and loaded
// from node_modules). Only our own @livedesk/* workspace code is bundled in,
// because it's TypeScript source that Node can't run directly.
import { build } from 'esbuild'

/** Marks bare imports (npm packages) external, except our workspaces. */
const externalPackages = {
  name: 'external-packages',
  setup(b) {
    b.onResolve({ filter: /^[^./]/ }, (args) =>
      args.path.startsWith('@livedesk/') ? undefined : { path: args.path, external: true },
    )
  },
}

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  plugins: [externalPackages],
  logLevel: 'info',
})
