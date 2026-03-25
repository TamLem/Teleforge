const DEFAULT_MAX_AGE = 60 * 60 * 24;

export function buildDataCheckString(params: URLSearchParams): string {
  return collectSignedFieldLines(params).join("\n");
}

export function buildThirdPartyDataCheckString(params: URLSearchParams, botId: number): string {
  return [`${botId}:WebAppData`, ...collectSignedFieldLines(params)].join("\n");
}

export function collectSignedFieldLines(params: URLSearchParams): string[] {
  return [...params.entries()]
    .filter(([key]) => key !== "hash" && key !== "signature")
    .map(([key, value]) => `${key}=${value}`)
    .sort();
}

export function normalizeMaxAge(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return DEFAULT_MAX_AGE;
  }

  return value;
}

export function parseAuthDate(value: string | null): number | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
