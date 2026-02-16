/**
 * Normalize place name for matching/dedup:
 * - lowercase
 * - remove common suffixes (본점, 지점, 점)
 * - collapse whitespace
 *
 * Shared module safe for both client and server.
 */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s*(본점|지점|점|역점|직영점)\s*$/g, "")
    .replace(/\s+/g, " ");
}
