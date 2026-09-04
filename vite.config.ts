import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Emit the service worker with the real built filenames baked in.
 *
 * A hand-written worker cannot know the hashed asset names, and a plugin that
 * generates one would be a dependency for what is thirty lines of substitution.
 * The template is read, the bundle's own file list is substituted in, and the
 * result is written beside it.
 */
function serviceWorker(): Plugin {
  let outDir = 'dist'
  return {
    name: 'cadence-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    writeBundle(_options, bundle) {
      const assets = Object.keys(bundle).map((name) => `./${name}`)
      // The shell itself, plus everything the manifest points at.
      const precache = [
        './',
        './index.html',
        './manifest.webmanifest',
        './icon.svg',
        './apple-touch-icon.png',
        './icon-192.png',
        './icon-512.png',
        ...assets,
      ].filter((url, i, all) => all.indexOf(url) === i)

      const template = readFileSync(join(__dirname, 'src/sw-template.js'), 'utf8')
      // The version is a digest of what is cached, so a rebuild that changes
      // nothing does not evict a working cache.
      const version = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 12)

      writeFileSync(
        join(outDir, 'sw.js'),
        template
          .replace(/__PRECACHE__/g, JSON.stringify(precache, null, 2))
          .replace(/__VERSION__/g, version),
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  // Relative asset URLs, so the built app works wherever it is served from:
  // a domain root, a GitHub Pages project subpath (/Best/), or file preview.
  base: './',
  server: { port: 5173 },
})
