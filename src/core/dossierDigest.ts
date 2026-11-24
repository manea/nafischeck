function stableSortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableSortValue(item));
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = stableSortValue(obj[key]);
    }
    return sorted;
  }
  return value;
}

export function canonicalizeDossierPayload(payload: unknown): string {
  return JSON.stringify(stableSortValue(payload));
}

export async function computePayloadDigest(canonicalText: string): Promise<string> {
  const bytes = new TextEncoder().encode(String(canonicalText || ''));
  const digestBuffer = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digestBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function computeDossierSha256(payload: unknown): Promise<string> {
  return computePayloadDigest(canonicalizeDossierPayload(payload));
}
