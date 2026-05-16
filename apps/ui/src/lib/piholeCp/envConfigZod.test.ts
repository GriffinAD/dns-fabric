import { describe, expect, it } from "vitest";

import {
  envConfigResponseSchema,
  envPatchResponseSchema,
  envSchemaResponseSchema,
} from "./envConfigZod";

describe("envConfigZod", () => {
  it("parses env schema response", () => {
    const parsed = envSchemaResponseSchema.parse({
      keys: [
        {
          key: "DNSCRYPT_PROXY_ENABLED",
          tier: 1,
          type: "boolean",
          label: "DNSCrypt",
          requires_apply: true,
        },
      ],
    });
    expect(parsed.keys[0]?.key).toBe("DNSCRYPT_PROXY_ENABLED");
  });

  it("parses env config response", () => {
    const parsed = envConfigResponseSchema.parse({
      effective: { DNSCRYPT_PROXY_ENABLED: "0" },
      pending: null,
    });
    expect(parsed.effective.DNSCRYPT_PROXY_ENABLED).toBe("0");
  });

  it("coerces numeric env values to strings", () => {
    const parsed = envConfigResponseSchema.parse({
      effective: { CONTROL_PLANE_UI_HOST_PORT: 8091 },
    });
    expect(parsed.effective.CONTROL_PLANE_UI_HOST_PORT).toBe("8091");
  });

  it("parses PATCH response with staged only", () => {
    const parsed = envPatchResponseSchema.parse({
      staged: { DNSCRYPT_PROXY_ENABLED: "1" },
    });
    expect(parsed.staged.DNSCRYPT_PROXY_ENABLED).toBe("1");
    expect(parsed.pending).toBeUndefined();
  });
});
