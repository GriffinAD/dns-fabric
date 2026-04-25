const ipv4Pattern = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const macPattern = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

export function isValidIpv4Address(value: unknown): boolean {
  return ipv4Pattern.test(String(value ?? "").trim());
}

export function isValidMacAddress(value: unknown): boolean {
  return macPattern.test(String(value ?? "").trim());
}

export function validateIpv4Address(value: unknown): string | null {
  return isValidIpv4Address(value) ? null : "Invalid IPv4 address";
}

export function validateMacAddress(value: unknown): string | null {
  return isValidMacAddress(value) ? null : "Invalid MAC address";
}
