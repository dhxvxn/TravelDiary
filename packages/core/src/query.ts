/**
 * Build a URL query string. Used instead of URLSearchParams, which React Native only partly implements.
 * Undefined values are skipped.
 */
export function query(params: Record<string, string | undefined>): string {
  return Object.entries(params)
    .filter((e): e is [string, string] => e[1] !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}
