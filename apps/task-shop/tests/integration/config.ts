export interface IntegrationConfig {
  botId: number | null;
  botToken: string | null;
  miniAppUrl: string | null;
  mode: "live" | "mock";
  publicKey: string | null;
  timeout: number;
}

export const integrationConfig: IntegrationConfig = {
  botId: parseInteger(process.env.TEST_BOT_ID),
  botToken: normalize(process.env.TEST_BOT_TOKEN),
  miniAppUrl: normalize(process.env.TEST_MINI_APP_URL),
  mode:
    normalize(process.env.TEST_BOT_TOKEN) &&
    normalize(process.env.TEST_MINI_APP_URL) &&
    normalize(process.env.TEST_PUBLIC_KEY) &&
    parseInteger(process.env.TEST_BOT_ID) !== null
      ? "live"
      : "mock",
  publicKey: normalize(process.env.TEST_PUBLIC_KEY),
  timeout: 30_000
};

function normalize(value: string | undefined): string | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  return value;
}

function parseInteger(value: string | undefined): number | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}
