import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import selfsigned from "selfsigned";

export async function ensureCertificates(
  cwd: string
): Promise<{ certPath: string; keyPath: string }> {
  const directory = path.join(cwd, ".teleforge", "certs");
  const certPath = path.join(directory, "localhost-cert.pem");
  const keyPath = path.join(directory, "localhost-key.pem");

  await mkdir(directory, { recursive: true });

  try {
    await readFile(certPath, "utf8");
    await readFile(keyPath, "utf8");
    return { certPath, keyPath };
  } catch {
    const generated = selfsigned.generate([{ name: "commonName", value: "localhost" }], {
      algorithm: "sha256",
      days: 30,
      keySize: 2048,
      extensions: [
        {
          altNames: [
            { type: 2, value: "localhost" },
            { ip: "127.0.0.1", type: 7 }
          ],
          name: "subjectAltName"
        }
      ]
    });

    await writeFile(certPath, generated.cert, "utf8");
    await writeFile(keyPath, generated.private, "utf8");
    return { certPath, keyPath };
  }
}
