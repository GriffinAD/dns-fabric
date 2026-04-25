export type BasePaginationDensity = "compact" | "default" | "expanded";

export type BasePaginationToken =
  | { kind: "page"; page: number }
  | { kind: "ellipsis"; id: "left" | "right" };

export function slotsForDensity(density: BasePaginationDensity): number {
  if (density === "compact") return 5;
  if (density === "expanded") return 9;
  return 7;
}

function pushPage(tokens: BasePaginationToken[], page: number) {
  tokens.push({ kind: "page", page });
}

function pushGap(tokens: BasePaginationToken[], id: "left" | "right") {
  tokens.push({ kind: "ellipsis", id });
}

/**
 * Builds stable, fixed-slot pagination tokens while always rendering first/last pages.
 * All page values are 1-based.
 */
export function buildPaginationTokens(
  totalPages: number,
  currentPage: number,
  slotCount: number,
): BasePaginationToken[] {
  if (totalPages <= 1) return [];
  if (totalPages <= slotCount) {
    return Array.from({ length: totalPages }, (_, i) => ({ kind: "page", page: i + 1 }));
  }

  const interiorSlots = Math.max(1, slotCount - 2);
  const edgePageCount = Math.max(1, interiorSlots - 1);

  const tokens: BasePaginationToken[] = [];
  pushPage(tokens, 1);
  if (currentPage <= edgePageCount) {
    const end = Math.min(totalPages - 1, 1 + edgePageCount);
    for (let p = 2; p <= end; p += 1) {
      pushPage(tokens, p);
    }
    pushGap(tokens, "right");
    pushPage(tokens, totalPages);
    return tokens;
  }

  if (currentPage >= totalPages - edgePageCount + 1) {
    pushGap(tokens, "left");
    const start = Math.max(2, totalPages - edgePageCount);
    for (let p = start; p <= totalPages - 1; p += 1) {
      pushPage(tokens, p);
    }
    pushPage(tokens, totalPages);
    return tokens;
  }

  const middlePageCount = Math.max(1, interiorSlots - 2);
  const leftOffset = Math.floor((middlePageCount - 1) / 2);
  const middleStart = currentPage - leftOffset;
  const middleEnd = middleStart + middlePageCount - 1;

  pushGap(tokens, "left");
  for (let p = middleStart; p <= middleEnd; p += 1) {
    pushPage(tokens, p);
  }
  pushGap(tokens, "right");
  pushPage(tokens, totalPages);
  return tokens;
}

export function clampPage(page: number, totalPages: number): number {
  if (totalPages <= 1) return 1;
  return Math.max(1, Math.min(totalPages, page));
}
