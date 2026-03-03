import { toDiscordTimestamp } from "../lib/format";
import {
  getPlatformErrorRequestId,
  getPlatformRequestId,
  platformRequest,
} from "../lib/platform";

export interface SeasonApiError {
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

export interface ActiveSeasonSummary {
  season: {
    id: string;
    name: string;
    status: "active" | "draft" | "complete";
    roundsTotal: number;
    roundsComplete: number;
    driversRegistered: number;
  };
  nextRound: {
    id: string;
    number: number;
    name: string;
    scheduledAt: string | null;
  } | null;
}

export interface SeasonScheduleItem {
  id: string;
  number: number;
  name: string;
  status: "upcoming" | "live" | "complete";
  scheduledAt: string | null;
}

export interface SeasonScheduleResponse {
  season: {
    id: string;
    name: string;
  };
  rounds: SeasonScheduleItem[];
}

export interface ServiceSuccess<TData> {
  ok: true;
  data: TData;
}

export type ServiceResult<TData> = ServiceSuccess<TData> | ServiceFailure;

export function mapSeasonApiError(
  status: number,
  code: string | undefined,
  fallback: string,
  detail: string | undefined,
): string {
  if (code === "UNAUTHORIZED") {
    return "Bot authentication failed while requesting season data.";
  }

  if (code === "ACTIVE_SEASON_NOT_FOUND") {
    return "No active season is currently available.";
  }

  if (detail?.trim()) {
    return `HTTP ${status} — ${fallback}: ${detail.trim()}`;
  }

  return `HTTP ${status} — ${fallback}`;
}

async function parseErrorResponse(
  response: Response,
  fallbackMessage: string,
): Promise<ServiceFailure> {
  const contentType = response.headers.get("content-type") ?? "";
  let code: string | undefined;
  let fallback = fallbackMessage;
  let detail: string | undefined;

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as SeasonApiError;
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
    message: mapSeasonApiError(response.status, code, fallback, detail),
  };
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
      ? "Request timed out while contacting season API. Please retry."
      : "Could not reach season API. Please retry.",
  };
}

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatScheduleLine(round: SeasonScheduleItem): string {
  const when = parseIsoDate(round.scheduledAt);
  const scheduleText = when ? toDiscordTimestamp(when, "F") : "TBD";
  return `Round/${round.number} — ${round.name} · ${round.status.toUpperCase()} · ${scheduleText}`;
}

export async function fetchActiveSeasonSummary(
  timeoutMs = 8000,
): Promise<ServiceResult<ActiveSeasonSummary>> {
  let response: Response;

  try {
    response = await platformRequest("/api/bot/season/summary", {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    return getNetworkFailure(error);
  }

  if (!response.ok) {
    return parseErrorResponse(response, "Failed to fetch season summary.");
  }

  try {
    const payload = (await response.json()) as ActiveSeasonSummary;
    if (
      !payload?.season?.id ||
      !payload.season.name ||
      typeof payload.season.roundsTotal !== "number" ||
      typeof payload.season.roundsComplete !== "number" ||
      typeof payload.season.driversRegistered !== "number"
    ) {
      return {
        ok: false,
        status: 200,
        code: "INVALID_RESPONSE",
        requestId: getPlatformRequestId(response),
        retryable: false,
        message: "HTTP 200 — Invalid season summary response.",
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
      message: "HTTP 200 — Invalid season summary response.",
    };
  }
}

export async function fetchSeasonSchedule(
  timeoutMs = 8000,
): Promise<ServiceResult<SeasonScheduleResponse>> {
  let response: Response;

  try {
    response = await platformRequest("/api/bot/season/schedule", {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    return getNetworkFailure(error);
  }

  if (!response.ok) {
    return parseErrorResponse(response, "Failed to fetch season schedule.");
  }

  try {
    const payload = (await response.json()) as SeasonScheduleResponse;
    if (
      !payload?.season?.id ||
      !payload.season.name ||
      !Array.isArray(payload.rounds)
    ) {
      return {
        ok: false,
        status: 200,
        code: "INVALID_RESPONSE",
        requestId: getPlatformRequestId(response),
        retryable: false,
        message: "HTTP 200 — Invalid season schedule response.",
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
      message: "HTTP 200 — Invalid season schedule response.",
    };
  }
}
