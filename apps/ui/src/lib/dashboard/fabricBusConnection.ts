import type { FabricConnectionState } from "./eventBus";

export function fabricConnectionLabel(state: FabricConnectionState): string {
  switch (state) {
    case "open":
      return "Live";
    case "connecting":
      return "Connecting…";
    case "error":
      return "Stream error";
    default:
      return "Data idle";
  }
}

export function fabricConnectionDotClass(state: FabricConnectionState): string {
  switch (state) {
    case "open":
      return "bg-emerald-500";
    case "connecting":
      return "bg-amber-400 animate-pulse";
    case "error":
      return "bg-red-500";
    default:
      return "bg-slate-400 dark:bg-gray-500";
  }
}
