import { generateKeyPairSync, sign } from "node:crypto";

export interface Ed25519SampleVector {
  botId: number;
  initData: string;
  publicKeyBytes: Uint8Array;
  publicKeyHex: string;
  tamperedInitData: string;
}

export function createEd25519SampleVector(
  options: {
    authDate?: number;
    botId?: number;
    startParam?: string;
  } = {}
): Ed25519SampleVector {
  const authDate = options.authDate ?? 1_710_000_000;
  const botId = options.botId ?? 12_345_678;
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const params = new URLSearchParams();

  params.set("auth_date", String(authDate));
  params.set("query_id", "AAHdF6IQAAAAAN0XohDhrOrc");
  params.set(
    "user",
    JSON.stringify({
      first_name: "Integration",
      id: 279058397,
      username: "integration_user"
    })
  );

  if (options.startParam) {
    params.set("start_param", options.startParam);
  }

  const dataCheckString = [
    `${botId}:WebAppData`,
    ...[...params.entries()].map(([key, value]) => `${key}=${value}`).sort()
  ].join("\n");
  const signature = sign(null, Buffer.from(dataCheckString), privateKey)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  params.set("signature", signature);

  const publicKeyDer = publicKey.export({
    format: "der",
    type: "spki"
  });
  const publicKeyBytes = Uint8Array.from(publicKeyDer.subarray(12));

  return {
    botId,
    initData: params.toString(),
    publicKeyBytes,
    publicKeyHex: publicKeyDer.subarray(12).toString("hex"),
    tamperedInitData: params.toString().replace("Integration", "Tampered")
  };
}
