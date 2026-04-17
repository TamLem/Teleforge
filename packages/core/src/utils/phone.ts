const PHONE_AUTH_PATTERN = /^\+?[0-9]{8,15}$/;

export function normalizePhoneNumber(value: string): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  let normalized = "";
  let hasLeadingPlus = false;

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (char === "+") {
      if (index !== 0 || hasLeadingPlus) {
        return null;
      }

      hasLeadingPlus = true;
      normalized += char;
      continue;
    }

    if (char >= "0" && char <= "9") {
      normalized += char;
      continue;
    }

    if (char === " " || char === "-" || char === "(" || char === ")") {
      continue;
    }

    return null;
  }

  return PHONE_AUTH_PATTERN.test(normalized) ? normalized : null;
}
