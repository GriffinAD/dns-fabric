import { describe, expect, it } from "vitest";

import {
  DND_ADD_GROUP,
  DND_LAYOUT_DND,
  DND_PLUGIN_MIME,
  PLAIN_ADD_GROUP,
  PLAIN_PLUGIN_PREFIX,
  isPaletteFabricHtml5Drag,
  parsePaletteDrop,
  setPaletteAddGroupDragData,
  setPalettePluginDragData,
} from "./paletteDragCodec";

function mockTransfer(data: Record<string, string>): DataTransfer {
  return {
    getData: (k: string) => data[k] ?? "",
  } as DataTransfer;
}

describe("paletteDragCodec", () => {
  it("isPaletteFabricHtml5Drag is true when plugin MIME is listed in types", () => {
    const dt = { types: [DND_PLUGIN_MIME] } as unknown as DataTransfer;
    expect(isPaletteFabricHtml5Drag(dt)).toBe(true);
  });

  it("isPaletteFabricHtml5Drag is true when layout MIME is listed in types", () => {
    const dt = { types: [DND_LAYOUT_DND] } as unknown as DataTransfer;
    expect(isPaletteFabricHtml5Drag(dt)).toBe(true);
  });

  it("isPaletteFabricHtml5Drag is false for text/plain only", () => {
    const dt = { types: ["text/plain"] } as unknown as DataTransfer;
    expect(isPaletteFabricHtml5Drag(dt)).toBe(false);
  });

  it("isPaletteFabricHtml5Drag is false for null or missing types", () => {
    expect(isPaletteFabricHtml5Drag(null)).toBe(false);
    expect(isPaletteFabricHtml5Drag({} as DataTransfer)).toBe(false);
  });

  it("parsePaletteDrop reads add-group from layout MIME", () => {
    expect(parsePaletteDrop(mockTransfer({ [DND_LAYOUT_DND]: DND_ADD_GROUP }))).toEqual({ kind: "group" });
  });

  it("parsePaletteDrop reads plugin from MIME", () => {
    expect(parsePaletteDrop(mockTransfer({ [DND_PLUGIN_MIME]: "dhcp.pools" }))).toEqual({
      kind: "plugin",
      id: "dhcp.pools",
    });
  });

  it("parsePaletteDrop reads plain plugin prefix", () => {
    const plain = `${PLAIN_PLUGIN_PREFIX}perf.cpu`;
    expect(parsePaletteDrop(mockTransfer({ "text/plain": plain }))).toEqual({ kind: "plugin", id: "perf.cpu" });
  });

  it("parsePaletteDrop reads plain add-group", () => {
    expect(parsePaletteDrop(mockTransfer({ "text/plain": PLAIN_ADD_GROUP }))).toEqual({ kind: "group" });
  });

  it("parsePaletteDrop returns null for unrelated plain text", () => {
    expect(parsePaletteDrop(mockTransfer({ "text/plain": "not-a-palette-payload" }))).toBeNull();
  });

  it("parsePaletteDrop rejects oversized plugin id", () => {
    const id = "x".repeat(300);
    expect(parsePaletteDrop(mockTransfer({ [DND_PLUGIN_MIME]: id }))).toBeNull();
  });

  it("parsePaletteDrop rejects plain prefix with empty id", () => {
    expect(parsePaletteDrop(mockTransfer({ "text/plain": PLAIN_PLUGIN_PREFIX }))).toBeNull();
  });

  it("setPalettePluginDragData ignores oversized plugin ids", () => {
    const dt = {
      _data: {} as Record<string, string>,
      setData(this: { _data: Record<string, string> }, k: string, v: string) {
        this._data[k] = v;
      },
      getData(this: { _data: Record<string, string> }, k: string) {
        return this._data[k] ?? "";
      },
    };
    const ev = { dataTransfer: dt } as unknown as DragEvent;
    setPalettePluginDragData(ev, "x".repeat(400));
    expect(Object.keys(dt._data).length).toBe(0);
  });

  it("setPalettePluginDragData round-trips via parsePaletteDrop", () => {
    const dt = {
      _data: {} as Record<string, string>,
      setData(this: { _data: Record<string, string> }, k: string, v: string) {
        this._data[k] = v;
      },
      getData(this: { _data: Record<string, string> }, k: string) {
        return this._data[k] ?? "";
      },
    };
    const ev = { dataTransfer: dt } as unknown as DragEvent;
    setPalettePluginDragData(ev, "discovery.records");
    expect(parsePaletteDrop(dt as unknown as DataTransfer)).toEqual({ kind: "plugin", id: "discovery.records" });
  });

  it("setPaletteAddGroupDragData round-trips", () => {
    const dt = {
      _data: {} as Record<string, string>,
      setData(this: { _data: Record<string, string> }, k: string, v: string) {
        this._data[k] = v;
      },
      getData(this: { _data: Record<string, string> }, k: string) {
        return this._data[k] ?? "";
      },
    };
    setPaletteAddGroupDragData({ dataTransfer: dt } as unknown as DragEvent);
    expect(parsePaletteDrop(dt as unknown as DataTransfer)).toEqual({ kind: "group" });
  });
});
