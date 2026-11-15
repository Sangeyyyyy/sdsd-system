/**
 * Human-friendly booking reference codes.
 *
 * Ambiguous characters (0/O, 1/I/L) are excluded so codes are easy to read
 * from a screenshot or to type back into the lookup page.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomIndex(max: number): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % max;
}

export function newReferenceCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[randomIndex(ALPHABET.length)];
  }
  return `SDSD-${code}`;
}

export function normalizeReferenceCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}
