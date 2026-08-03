import { assertDomain } from "./errors.js";

function normalize(value: unknown, seen: Set<object>): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    assertDomain(Number.isFinite(value), "SERIALIZATION_ERROR", "No se permiten números no finitos.");
    return value;
  }
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
    throw new TypeError("El valor no es serializable como JSON de dominio.");
  }
  if (Array.isArray(value)) {
    assertDomain(!seen.has(value), "SERIALIZATION_ERROR", "No se permiten ciclos.");
    seen.add(value);
    const normalized = value.map((entry) => normalize(entry, seen));
    seen.delete(value);
    return normalized;
  }
  if (typeof value === "object") {
    assertDomain(!seen.has(value), "SERIALIZATION_ERROR", "No se permiten ciclos.");
    seen.add(value);
    const record = value as Readonly<Record<string, unknown>>;
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const entry = record[key];
      if (entry !== undefined) {
        normalized[key] = normalize(entry, seen);
      }
    }
    seen.delete(value);
    return normalized;
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(normalize(value, new Set()));
}

export function utf8Bytes(value: string): readonly number[] {
  const bytes: number[] = [];
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    assertDomain(
      codePoint !== undefined,
      "SERIALIZATION_ERROR",
      "No se pudo codificar el texto.",
    );
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6));
      bytes.push(0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(0xe0 | (codePoint >> 12));
      bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
      bytes.push(0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(0xf0 | (codePoint >> 18));
      bytes.push(0x80 | ((codePoint >> 12) & 0x3f));
      bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
      bytes.push(0x80 | (codePoint & 0x3f));
    }
  }
  return bytes;
}

export function utf8ByteLength(value: string): number {
  let length = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    assertDomain(
      codePoint !== undefined,
      "SERIALIZATION_ERROR",
      "No se pudo medir el texto.",
    );
    if (codePoint <= 0x7f) {
      length += 1;
    } else if (codePoint <= 0x7ff) {
      length += 2;
    } else if (codePoint <= 0xffff) {
      length += 3;
    } else {
      length += 4;
    }
  }
  return length;
}

export function nonCryptographicDigest(value: unknown): string {
  const text = stableStringify(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (const byte of utf8Bytes(text)) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & mask;
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}
