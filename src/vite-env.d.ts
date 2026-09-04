/**
 * The two build-time flags this app reads. Declared here rather than pulled in
 * from `vite/client` so the app keeps its own type surface small.
 */
interface ImportMetaEnv {
  readonly PROD: boolean
  readonly DEV: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
