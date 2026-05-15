import { describe, expect, it } from "vitest";

import { envConfigResponseSchema, envSchemaResponseSchema } from "./envConfigZod";

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
});
