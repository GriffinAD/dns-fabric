import { writable } from "svelte/store";

export type EditorSelection =
  | { kind: "tile"; id: string; label: string }
  | { kind: "group"; id: string; label: string }
  | null;

/** Ephemeral inspector selection (not persisted in layout JSON). */
export const editorSelection = writable<EditorSelection>(null);
