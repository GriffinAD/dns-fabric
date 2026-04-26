/**
 * Keeps the first occurrence of each `id`. Cross-zone DnD or bad saves can duplicate group
 * children; Svelte keyed `{#each ... (id)}` then throws `each_key_duplicate`.
 */
export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of items) {
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(x);
  }
  return out;
}
