import { toDiscordTimestamp } from "../lib/format";
import {
  getPlatformErrorRequestId,
  getPlatformRequestId,
  platformRequest,
} from "../lib/platform";

interface ApiErrorPayload {
  error?: string;
  detail?: string;
  code?: string;
}

export interface ServiceFailure {
  ok: false;
  status: number;
  code?: string;
  requestId?: string;
  message: string;
  retryable: boolean;
}

export interface ServiceSuccess<TData> {
  ok: true;
  data: TData;
}

export type ServiceResult<TData> = ServiceSuccess<TData> | ServiceFailure;

export interface StreaksResponse {
  driver: { id: string; gamertag: string };
  season: { id: string; name: string };
  streaks: {
    participation: number;
    podium: number;
    top10: number;
  };
  current: {
    participation: number;
    podium: number;
    top10: number;
  };
}

export interface ConsistencyResponse {
  driver: { id: string; gamertag: string };
  season: { id: string; name: string };
  stats: {
    avgFinish: number;
    finishStdDev: number;
    participations: number;
    bestFinish: number;
    worstFinish: number;
  };
  trend: "improving" | "stable" | "declining";
}

export interface XpHistoryItem {
  id: string;
  type: string;
  amount: number;
  roundId: string | null;
  createdAt: string;
  reason?: string;
}

export interface XpHistoryResponse {
  driver: { id: string; gamertag: string };
  items: XpHistoryItem[];
}

export function mapReliabilityApiError(
  status: number,
  code: string | undefined,
  fallback: string,
  detail: string | undefined,
): string {
  if (code === "UNAUTHORIZED") {
    return "Bot authentication failed while requesting reliability data.";
  }

  if (code === "DRIVER_NOT_LINKED") {
    return "Your Discord account is not linked. Use /register first.";
  }

  if (code === "DRIVER_NOT_FOUND") {
    return "Driver data was not found.";
  }

  if (code === "ACTIVE_SEASON_NOT_FOUND") {
    return "No active season is currently available.";
  }

  if (detail?.trim()) {
    return `HTTP ${status} — ${fallback}: ${detail.trim()}`;
  }

  return `HTTP ${status} — ${fallback}`;
}

export function getTrendLabel(
  trend: "improving" | "stable" | "declining",
): string {
  if (trend === "improving") return "Improving ↗";
  if (trend === "declining") return "Declining ↘";
  return "Stable →";
}

export function formatXpHistoryLine(item: XpHistoryItem): string {
  const when = new Date(item.createdAt);
  const timestamp = Number.isNaN(when.getTime())
    ? item.createdAt
    : toDiscordTimestamp(when, "R");

  const amountPrefix = item.amount >= 0 ? "+" : "";
  const reasonSuffix = item.reason?.trim() ? ` · ${item.reason.trim()}` : "";
  return `${amountPrefix}${item.amount} XP · ${item.type}${reasonSuffix} · ${timestamp}`;
}

function getNetworkFailure(error: unknown): ServiceFailure {
  const errorName =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name: unknown }).name)
      : "Error";
  const timedOut = errorName === "TimeoutError" || errorName === "AbortError";

  return {
    ok: false,
    status: 0,
    code: timedOut ? "TIMEOUT" : "NETWORK_ERROR",
    requestId: getPlatformErrorRequestId(error),
    retryable: true,
    message: timedOut
      ? "Request timed out while contacting reliability API. Please retry."
      : "Could not reach reliability API. Please retry.",
  };
}

async function parseError(
  response: Response,
  fallbackMessage: string,
): Promise<ServiceFailure> {
  const contentType = response.headers.get("content-type") ?? "";
  let code: string | undefined;
  let fallback = fallbackMessage;
  let detail: string | undefined;

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as ApiErrorPayload;
      code = payload.code;
      fallback = payload.error?.trim() || fallback;
      detail = payload.detail;
    } catch {
      // keep defaults
    }
  } else {
    const text = await response.text().catch(() => "");
    if (text.trim()) {
      fallback = text.trim().slice(0, 200);
    }
  }

  return {
    ok: false,
    status: response.status,
    code,
    requestId: getPlatformRequestId(response),
    retryable: response.status >= 500,
    message: mapReliabilityApiError(response.status, code, fallback, detail),
  };
}

export async function fetchStreaks(
  discordId: string,
  seasonId?: string,
  timeoutMs = 8000,
): Promise<ServiceResult<StreaksResponse>> {
  let response: Response;
  try {
    response = await platformRequest("/api/bot/streaks", {
      method: "GET",
      query: { discordId, seasonId },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    return getNetworkFailure(error);
  }

  if (!response.ok) return parseError(response, "Failed to fetch streaks.");

  try {
    const payload = (await response.json()) as StreaksResponse;
    if (
      !payload?.driver?.id ||
      !payload.driver.gamertag ||
      !payload?.season?.id ||
      !payload.season.name
    ) {
      return {
        ok: false,
        status: 200,
        code: "INVALID_RESPONSE",
        requestId: getPlatformRequestId(response),
        retryable: false,
        message: "HTTP 200 — Invalid streaks response.",
      };
    }

    return { ok: true, data: payload };
  } catch {
    return {
      ok: false,
      status: 200,
      code: "INVALID_RESPONSE",
      requestId: getPlatformRequestId(response),
      retryable: false,
      message: "HTTP 200 — Invalid streaks response.",
    };
  }
}

export async function fetchConsistency(
  discordId: string,
  seasonId?: string,
  timeoutMs = 8000,
): Promise<ServiceResult<ConsistencyResponse>> {
  let response: Response;
  try {
    response = await platformRequest("/api/bot/consistency", {
      method: "GET",
      query: { discordId, seasonId },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    return getNetworkFailure(error);
  }

  if (!response.ok) {
    return parseError(response, "Failed to fetch consistency.");
  }

  try {
    const payload = (await response.json()) as ConsistencyResponse;
    if (
      !payload?.driver?.id ||
      !payload.driver.gamertag ||
      !payload?.season?.id ||
      !payload.season.name
    ) {
      return {
        ok: false,
        status: 200,
        code: "INVALID_RESPONSE",
        requestId: getPlatformRequestId(response),
        retryable: false,
        message: "HTTP 200 — Invalid consistency response.",
      };
    }

    return { ok: true, data: payload };
  } catch {
    return {
      ok: false,
      status: 200,
      code: "INVALID_RESPONSE",
      requestId: getPlatformRequestId(response),
      retryable: false,
      message: "HTTP 200 — Invalid consistency response.",
    };
  }
}

export async function fetchXpHistory(
  discordId: string,
  limit = 10,
  timeoutMs = 8000,
): Promise<ServiceResult<XpHistoryResponse>> {
  let response: Response;
  try {
    response = await platformRequest("/api/bot/xp/history", {
      method: "GET",
      query: { discordId, limit: String(limit) },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    return getNetworkFailure(error);
  }

  if (!response.ok) {
    return parseError(response, "Failed to fetch XP history.");
  }

  try {
    const payload = (await response.json()) as XpHistoryResponse;
    if (
      !payload?.driver?.id ||
      !payload.driver.gamertag ||
      !Array.isArray(payload.items)
    ) {
      return {
        ok: false,
        status: 200,
        code: "INVALID_RESPONSE",
        requestId: getPlatformRequestId(response),
        retryable: false,
        message: "HTTP 200 — Invalid XP history response.",
      };
    }

    return { ok: true, data: payload };
  } catch {
    return {
      ok: false,
      status: 200,
      code: "INVALID_RESPONSE",
      requestId: getPlatformRequestId(response),
      retryable: false,
      message: "HTTP 200 — Invalid XP history response.",
    };
  }
}
