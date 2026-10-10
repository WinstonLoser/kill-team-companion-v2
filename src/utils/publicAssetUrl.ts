/** Resolve a file in public/ against Vite's deployment base (including Pages subpaths). */
export function publicAssetUrl(path: string, base = import.meta.env.BASE_URL): string {
  return `${base.endsWith('/') ? base : `${base}/`}${path.replace(/^\/+/, '')}`
}
