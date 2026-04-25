import { describe, expect, it } from "vitest";

import {
  isValidIpv4Address,
  isValidMacAddress,
  validateIpv4Address,
  validateMacAddress,
} from "./netValidation";

describe("netValidation", () => {
  it("validates IPv4 addresses", () => {
    expect(isValidIpv4Address("192.168.1.10")).toBe(true);
    expect(isValidIpv4Address("255.255.255.255")).toBe(true);
    expect(isValidIpv4Address("300.1.2.3")).toBe(false);
    expect(isValidIpv4Address("abc")).toBe(false);
  });

  it("validates MAC addresses", () => {
    expect(isValidMacAddress("52:54:01:00:20:0a")).toBe(true);
    expect(isValidMacAddress("52:54:01:00:20")).toBe(false);
    expect(isValidMacAddress("not-a-mac")).toBe(false);
  });

  it("returns user-facing validation messages", () => {
    expect(validateIpv4Address("10.1.2.3")).toBeNull();
    expect(validateIpv4Address("bad")).toBe("Invalid IPv4 address");
    expect(validateMacAddress("AA:BB:CC:DD:EE:FF")).toBeNull();
    expect(validateMacAddress("bad")).toBe("Invalid MAC address");
  });

  it("handles nullish and whitespace-padded values", () => {
    expect(isValidIpv4Address(" 10.0.0.1 ")).toBe(true);
    expect(isValidIpv4Address(null)).toBe(false);
    expect(isValidMacAddress(" aa:bb:cc:dd:ee:ff ")).toBe(true);
    expect(isValidMacAddress(undefined)).toBe(false);
  });
});
