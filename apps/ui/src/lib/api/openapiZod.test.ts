import { describe, expect, it } from "vitest";

import { baseFixtures } from "../../mock/fixtures";
import { mockFixtureSchemas, parseMockFixture } from "./openapiZod";

describe("mock fixtures match OpenAPI-shaped Zod schemas", () => {
  for (const path of Object.keys(mockFixtureSchemas)) {
    it(`validates ${path}`, () => {
      const body = baseFixtures[path];
      expect(body).toBeDefined();
      const parsed = parseMockFixture(path, body);
      expect(parsed).toBeDefined();
    });
  }

  it("every baseFixtures GET JSON key has a schema", () => {
    const fixtureKeys = Object.keys(baseFixtures);
    const schemaKeys = new Set(Object.keys(mockFixtureSchemas));
    for (const k of fixtureKeys) {
      expect(schemaKeys.has(k), `Add Zod schema for ${k}`).toBe(true);
    }
    expect(fixtureKeys.length).toBe(schemaKeys.size);
  });

  it("parseMockFixture throws for unknown path", () => {
    expect(() => parseMockFixture("/api/v1/unknown", {})).toThrow(/No Zod schema/);
  });
});
