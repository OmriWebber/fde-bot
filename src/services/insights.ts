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

export interface StandingsDeltaRow {
  driverId: string;
  gamertag: string;
  currentPosition: number;
  previousPosition: number | null;
  delta: number;
  totalScore: number;
}

export interface StandingsDeltaResponse {
  season: { id: string; name: string };
  sourceRound: { id: string; number: number };
  rows: StandingsDeltaRow[];
}

export interface CompareDriverStats {
  id: string;
  gamertag: string;
  totalScore: number;
  avgFinish: number;
  podiums: number;
  participations: number;
}

export interface CompareResponse {
  season: { id: string; name: string };
  driverA: CompareDriverStats;
  driverB: CompareDriverStats;
}

export interface RoundResultItem {
  position: number | null;
  score: number;
  driver: { id: string; gamertag: string };
}

export interface RoundResultsResponse {
  season: { id: string; name: string };
  round: {
    id: string;
    number: number;
    name: string;
    status: "upcoming" | "live" | "complete";
  };
  topResults: RoundResultItem[];
}

export function getDeltaSymbol(delta: number): "↑" | "↓" | "→" {
  if (delta > 0) return "↑";
  if (delta < 0) return "↓";
  return "→";
}

export function mapInsightsApiError(
  status: number,
  code: string | undefined,
  fallback: string,
  detail: string | undefined,
): string {
  if (code === "UNAUTHORIZED") {
    return "Bot authentication failed while requesting insight data.";
  }

  if (code === "ACTIVE_SEASON_NOT_FOUND") {
    return "No active season data found.";
  }

  if (code === "DRIVER_NOT_FOUND") {
    return "One or more drivers were not found.";
  }

  if (code === "INVALID_QUERY") {
    return "Invalid command input for this request.";
  }

  if (detail?.trim()) {
    return `HTTP ${status} — ${fallback}: ${detail.trim()}`;
  }

  return `HTTP ${status} — ${fallback}`;
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
      ? "Request timed out while contacting insight API. Please retry."
      : "Could not reach insight API. Please retry.",
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
    message: mapInsightsApiError(response.status, code, fallback, detail),
  };
}

export async function fetchStandingsDelta(
  seasonId?: string,
  timeoutMs = 8000,
): Promise<ServiceResult<StandingsDeltaResponse>> {
  let response: Response;

  try {
    response = await platformRequest("/api/bot/standings/delta", {
      method: "GET",
      query: { seasonId },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    return getNetworkFailure(error);
  }

  if (!response.ok) {
    return parseError(response, "Failed to fetch standings delta.");
  }

  try {
    const payload = (await response.json()) as StandingsDeltaResponse;
    if (
      !payload?.season?.id ||
      !payload.season.name ||
      !Array.isArray(payload.rows)
    ) {
      return {
        ok: false,
        status: 200,
        code: "INVALID_RESPONSE",
        requestId: getPlatformRequestId(response),
        retryable: false,
        message: "HTTP 200 — Invalid standings delta response.",
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
      message: "HTTP 200 — Invalid standings delta response.",
    };
  }
}

export async function fetchCompare(
  driverA: string,
  driverB: string,
  seasonId?: string,
  timeoutMs = 8000,
): Promise<ServiceResult<CompareResponse>> {
  let response: Response;

  try {
    response = await platformRequest("/api/bot/compare", {
      method: "GET",
      query: {
        a: driverA,
        b: driverB,
        seasonId,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    return getNetworkFailure(error);
  }

  if (!response.ok) {
    return parseError(response, "Failed to compare drivers.");
  }

  try {
    const payload = (await response.json()) as CompareResponse;
    if (
      !payload?.season?.id ||
      !payload.season.name ||
      !payload.driverA?.id ||
      !payload.driverA.gamertag ||
      !payload.driverB?.id ||
      !payload.driverB.gamertag
    ) {
      return {
        ok: false,
        status: 200,
        code: "INVALID_RESPONSE",
        requestId: getPlatformRequestId(response),
        retryable: false,
        message: "HTTP 200 — Invalid compare response.",
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
      message: "HTTP 200 — Invalid compare response.",
    };
  }
}

export async function fetchRoundResults(
  roundId?: string,
  timeoutMs = 8000,
): Promise<ServiceResult<RoundResultsResponse>> {
  let response: Response;

  try {
    response = await platformRequest("/api/bot/results", {
      method: "GET",
      query: { roundId },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    return getNetworkFailure(error);
  }

  if (!response.ok) {
    return parseError(response, "Failed to fetch round results.");
  }

  try {
    const payload = (await response.json()) as RoundResultsResponse;
    if (
      !payload?.season?.id ||
      !payload.season.name ||
      !payload.round?.id ||
      typeof payload.round.number !== "number" ||
      !payload.round.name ||
      !Array.isArray(payload.topResults)
    ) {
      return {
        ok: false,
        status: 200,
        code: "INVALID_RESPONSE",
        requestId: getPlatformRequestId(response),
        retryable: false,
        message: "HTTP 200 — Invalid results response.",
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
      message: "HTTP 200 — Invalid results response.",
    };
  }
}
