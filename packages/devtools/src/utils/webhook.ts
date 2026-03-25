import type { TeleforgeManifest } from "./manifest.js";

export interface ConfigureWebhookOptions {
  env: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  manifest: TeleforgeManifest;
  tunnelUrl: string;
}

export interface ConfigureWebhookResult {
  message: string;
  status: "configured" | "failed" | "skipped";
  warning?: string;
  webhookUrl?: string;
}

export async function configureTelegramWebhook(
  options: ConfigureWebhookOptions
): Promise<ConfigureWebhookResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const tokenEnv = options.manifest.bot?.tokenEnv;
  const webhookPath = options.manifest.bot?.webhook?.path;

  if (!tokenEnv) {
    return {
      status: "skipped",
      message: "Manifest does not define bot.tokenEnv. Skipping webhook auto-configuration."
    };
  }

  if (!webhookPath) {
    return {
      status: "skipped",
      message: "Manifest does not define bot.webhook.path. Skipping webhook auto-configuration."
    };
  }

  const token = options.env[tokenEnv];
  if (!token) {
    return {
      status: "skipped",
      message: `Environment variable ${tokenEnv} is missing. Skipping webhook auto-configuration.`
    };
  }

  const secretEnv = options.manifest.bot?.webhook?.secretEnv;
  const secretToken = secretEnv ? options.env[secretEnv] : undefined;
  const webhookUrl = `${options.tunnelUrl}${webhookPath}`;

  try {
    const setWebhookResponse = await fetchImpl(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        url: webhookUrl,
        ...(secretToken ? { secret_token: secretToken } : {})
      })
    });
    const setWebhookPayload = (await setWebhookResponse.json()) as {
      description?: string;
      ok?: boolean;
    };

    if (!setWebhookResponse.ok || !setWebhookPayload.ok) {
      return {
        status: "failed",
        message: setWebhookPayload.description ?? "Telegram Bot API rejected the webhook update."
      };
    }

    const infoResponse = await fetchImpl(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const infoPayload = (await infoResponse.json()) as {
      ok?: boolean;
      result?: { url?: string };
    };

    if (!infoResponse.ok || !infoPayload.ok) {
      return {
        status: "failed",
        message: "Webhook was set but could not be verified with getWebhookInfo.",
        webhookUrl,
        warning:
          secretEnv && !secretToken
            ? `Manifest references ${secretEnv}, but it was not set in the environment.`
            : undefined
      };
    }

    return {
      status: "configured",
      message: `Bot webhook configured: ${infoPayload.result?.url ?? webhookUrl}`,
      webhookUrl: infoPayload.result?.url ?? webhookUrl,
      warning:
        secretEnv && !secretToken
          ? `Manifest references ${secretEnv}, but it was not set in the environment.`
          : undefined
    };
  } catch (error) {
    return {
      status: "failed",
      message:
        error instanceof Error
          ? error.message
          : "Unexpected error while configuring the Telegram webhook."
    };
  }
}
