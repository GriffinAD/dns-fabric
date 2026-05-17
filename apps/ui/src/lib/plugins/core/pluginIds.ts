/** Equality for plugin id strings (palette DnD, guards avoid `pluginId ===` outside this module). */
export function pluginIdsEqual(a: string, b: string): boolean {
  return a === b;
}
