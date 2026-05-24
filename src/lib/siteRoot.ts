// Site root: origin + Vite base path, with no trailing slash.
// In dev this is "http://localhost:5173"; in subpath deploys
// (e.g. GitHub Pages) it's "https://oianmol.github.io/homekitten".
export function siteRoot(): string {
  const base = import.meta.env.BASE_URL || '/';
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  return window.location.origin + trimmed;
}
