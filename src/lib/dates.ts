/** '2026-11-05' → '11.5' */
export function formatMD(iso: string): string {
  return `${+iso.slice(5, 7)}.${+iso.slice(8, 10)}`
}
