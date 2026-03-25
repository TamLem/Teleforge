let fallbackCounter = 0;

export function generateEventId(): string {
  const cryptoApi = getCrypto();
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  fallbackCounter += 1;
  return `evt-${Date.now()}-${fallbackCounter}-${Math.random().toString(16).slice(2, 10)}`;
}

export function getTelegramPublisher(): { sendData: (data: string) => void } | null {
  const candidate = (
    globalThis as typeof globalThis & {
      window?: {
        Telegram?: {
          WebApp?: {
            sendData?: (data: string) => void;
          };
        };
      };
    }
  ).window?.Telegram?.WebApp;

  return typeof candidate?.sendData === "function"
    ? { sendData: candidate.sendData.bind(candidate) }
    : null;
}

function getCrypto(): { randomUUID?: () => string } | undefined {
  return (globalThis as typeof globalThis & { crypto?: { randomUUID?: () => string } }).crypto;
}
