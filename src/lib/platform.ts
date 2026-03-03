import { randomUUID } from "node:crypto";

interface PlatformRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | undefined>;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
  retries?: number;
}

const responseRequestIds = new WeakMap<Response, string>();

export class PlatformRequestError extends Error {
  public readonly requestId: string;

  public constructor(requestId: string, cause: unknown) {
    super("Platform request failed");
    this.name = "PlatformRequestError";
    this.requestId = requestId;

    if (cause !== undefined) {
      Object.assign(this, { cause });
    }
  }
}

export function getPlatformRequestId(response: Response): string | undefined {
  return (
    response.headers.get("x-request-id") ??
    response.headers.get("x-vercel-id") ??
    responseRequestIds.get(response)
  );
}

export function getPlatformErrorRequestId(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "requestId" in error &&
    typeof (error as { requestId: unknown }).requestId === "string"
  ) {
    return (error as { requestId: string }).requestId;
  }

  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return Math.floor(asNumber * 1000);
  }

  const asDate = new Date(value);
  if (!Number.isNaN(asDate.getTime())) {
    return Math.max(0, asDate.getTime() - Date.now());
  }

  return null;
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
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
  const requestId = randomUUID();
  headers.set("x-bot-request-id", requestId);
  if (secret) {
    headers.set("Authorization", `Bearer ${secret}`);
    headers.set("x-bot-secret", secret);
  }

  const method = options.method ?? "GET";
  const retries =
    typeof options.retries === "number"
      ? Math.max(0, options.retries)
      : method === "GET"
        ? 1
        : 0;

  let attempt = 0;
  while (true) {
    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: options.body,
        signal: options.signal,
      });
      responseRequestIds.set(response, requestId);

      if (!shouldRetryStatus(response.status) || attempt >= retries) {
        return response;
      }

      const retryAfterMs = parseRetryAfterMs(
        response.headers.get("retry-after"),
      );
      const backoffMs = retryAfterMs ?? Math.min(2000, 250 * 2 ** attempt);
      await sleep(backoffMs);
      attempt += 1;
    } catch (error: unknown) {
      const isAbortLike =
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (String((error as { name: unknown }).name) === "AbortError" ||
          String((error as { name: unknown }).name) === "TimeoutError");

      if (isAbortLike || attempt >= retries) {
        throw new PlatformRequestError(requestId, error);
      }

      await sleep(Math.min(2000, 250 * 2 ** attempt));
      attempt += 1;
    }
  }
}
