import { describe, expect, it } from "vitest";

import { shouldApplyCpLayoutResync, shouldMergeServerWidgets } from "./piholeCpLayoutResync";

describe("shouldApplyCpLayoutResync", () => {
  it("returns true when layoutResyncEpoch > 0 even if editor is open", () => {
    expect(
      shouldApplyCpLayoutResync({
        layoutResyncEpoch: 2,
        editorOpen: true,
        forceAfterEnvApply: false,
      }),
    ).toBe(true);
  });

  it("returns true when forceAfterEnvApply is set", () => {
    expect(
      shouldApplyCpLayoutResync({
        layoutResyncEpoch: 0,
        editorOpen: false,
        forceAfterEnvApply: true,
      }),
    ).toBe(true);
  });

  it("returns false when epoch is 0 and no force flag", () => {
    expect(
      shouldApplyCpLayoutResync({
        layoutResyncEpoch: 0,
        editorOpen: false,
        forceAfterEnvApply: false,
      }),
    ).toBe(false);
  });
});

describe("shouldMergeServerWidgets", () => {
  it("returns false when editor is open", () => {
    expect(shouldMergeServerWidgets(true)).toBe(false);
  });

  it("returns true when editor is closed", () => {
    expect(shouldMergeServerWidgets(false)).toBe(true);
  });
});
