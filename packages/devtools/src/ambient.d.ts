declare module "localtunnel" {
  interface Tunnel {
    url: string;
    close(): void | Promise<void>;
  }

  interface TunnelOptions {
    allow_invalid_cert?: boolean;
    port: number;
    host?: string;
    local_https?: boolean;
    subdomain?: string;
  }

  export default function localtunnel(options: TunnelOptions): Promise<Tunnel>;
}

declare module "selfsigned" {
  interface CertificateAttribute {
    name: string;
    value: string;
  }

  interface GenerateOptions {
    days?: number;
    keySize?: number;
    algorithm?: string;
    extensions?: Array<Record<string, unknown>>;
  }

  interface GeneratedCertificates {
    private: string;
    cert: string;
  }

  const selfsigned: {
    generate(attributes: CertificateAttribute[], options?: GenerateOptions): GeneratedCertificates;
  };

  export default selfsigned;
}

declare module "qrcode-terminal" {
  interface GenerateOptions {
    small?: boolean;
  }

  const qrcodeTerminal: {
    generate(text: string, options?: GenerateOptions, callback?: (qr: string) => void): void;
  };

  export default qrcodeTerminal;
}
