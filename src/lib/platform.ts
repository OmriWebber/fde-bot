interface PlatformRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | undefined>;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

export function getPlatformConfig(): {
  platformUrl: string;
  secret: string | null;
} {
  return {
    platformUrl: process.env.PLATFORM_URL ?? "https://forzadriftevents.com",
    secret: process.env.BOT_WEBHOOK_SECRET ?? null,
  };
}

export async function platformRequest(
  path: string,
  options: PlatformRequestOptions = {},
): Promise<Response> {
  const { platformUrl, secret } = getPlatformConfig();
  const url = new URL(path, platformUrl);

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  const headers = new Headers(options.headers);
  if (secret) {
    headers.set("Authorization", `Bearer ${secret}`);
    headers.set("x-bot-secret", secret);
  }

  return fetch(url.toString(), {
    method: options.method ?? "GET",
    headers,
    body: options.body,
    signal: options.signal,
  });
}
