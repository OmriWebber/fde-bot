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

export interface ReminderPreferences {
  discordId: string;
  reminders: {
    h24: boolean;
    h1: boolean;
    live: boolean;
  };
  channelId: string | null;
}

export interface ReminderPreferencesResponse {
  preferences: ReminderPreferences;
}

export interface ReminderPreferencesUpdateInput {
  discordId: string;
  reminders: {
    h24: boolean;
    h1: boolean;
    live: boolean;
  };
  channelId?: string | null;
}

export interface AnnounceRoundResponse {
  announcementId: string;
  channelId: string;
  round: {
    id: string;
    number: number;
    name: string;
  };
}

export interface RefreshCacheResponse {
  ok: true;
  scope: string;
  refreshedAt: string;
}

export function mapOperationsApiError(
  status: number,
  code: string | undefined,
  fallback: string,
  detail: string | undefined,
): string {
  if (code === "UNAUTHORIZED") {
    return "Bot authentication failed while requesting operation.";
  }

  if (code === "FORBIDDEN") {
    return "You do not have permission to run this operation.";
  }

  if (code === "DRIVER_NOT_LINKED") {
    return "Your Discord account is not linked. Use /register first.";
  }

  if (code === "ROUND_NOT_FOUND") {
    return "Round not found for announcement.";
  }

  if (detail?.trim()) {
    return `HTTP ${status} — ${fallback}: ${detail.trim()}`;
  }

  return `HTTP ${status} — ${fallback}`;
}

export function formatReminderPreferences(pref: ReminderPreferences): string {
  const channelText = pref.channelId
    ? `<#${pref.channelId}>`
    : "Default reminder channel";
  return [
    `24h: ${pref.reminders.h24 ? "ON" : "OFF"}`,
    `1h: ${pref.reminders.h1 ? "ON" : "OFF"}`,
    `Live: ${pref.reminders.live ? "ON" : "OFF"}`,
    `Channel: ${channelText}`,
  ].join("\n");
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
      ? "Request timed out while contacting operations API. Please retry."
      : "Could not reach operations API. Please retry.",
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
    message: mapOperationsApiError(response.status, code, fallback, detail),
  };
}

export async function fetchReminderPreferences(
  discordId: string,
  timeoutMs = 8000,
): Promise<ServiceResult<ReminderPreferencesResponse>> {
  let response: Response;
  try {
    response = await platformRequest("/api/bot/reminders/preferences", {
      method: "GET",
      query: { discordId },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    return getNetworkFailure(error);
  }

  if (!response.ok) {
    return parseError(response, "Failed to fetch reminder preferences.");
  }

  try {
    const payload = (await response.json()) as ReminderPreferencesResponse;
    if (
      !payload?.preferences?.discordId ||
      typeof payload.preferences.reminders?.h24 !== "boolean" ||
      typeof payload.preferences.reminders?.h1 !== "boolean" ||
      typeof payload.preferences.reminders?.live !== "boolean"
    ) {
      return {
        ok: false,
        status: 200,
        code: "INVALID_RESPONSE",
        requestId: getPlatformRequestId(response),
        retryable: false,
        message: "HTTP 200 — Invalid reminder preferences response.",
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
      message: "HTTP 200 — Invalid reminder preferences response.",
    };
  }
}

export async function updateReminderPreferences(
  input: ReminderPreferencesUpdateInput,
  timeoutMs = 8000,
): Promise<ServiceResult<ReminderPreferencesResponse>> {
  let response: Response;
  try {
    response = await platformRequest("/api/bot/reminders/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    return getNetworkFailure(error);
  }

  if (!response.ok) {
    return parseError(response, "Failed to update reminder preferences.");
  }

  try {
    const payload = (await response.json()) as ReminderPreferencesResponse;
    if (
      !payload?.preferences?.discordId ||
      typeof payload.preferences.reminders?.h24 !== "boolean" ||
      typeof payload.preferences.reminders?.h1 !== "boolean" ||
      typeof payload.preferences.reminders?.live !== "boolean"
    ) {
      return {
        ok: false,
        status: 200,
        code: "INVALID_RESPONSE",
        requestId: getPlatformRequestId(response),
        retryable: false,
        message: "HTTP 200 — Invalid reminder update response.",
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
      message: "HTTP 200 — Invalid reminder update response.",
    };
  }
}

export async function triggerAnnounceRound(
  discordId: string,
  roundId?: string,
  channelId?: string,
  timeoutMs = 8000,
): Promise<ServiceResult<AnnounceRoundResponse>> {
  let response: Response;
  try {
    response = await platformRequest("/api/bot/admin/announce-round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discordId, roundId, channelId }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    return getNetworkFailure(error);
  }

  if (!response.ok) {
    return parseError(response, "Failed to publish round announcement.");
  }

  try {
    const payload = (await response.json()) as AnnounceRoundResponse;
    if (!payload?.announcementId || !payload.channelId || !payload.round?.id) {
      return {
        ok: false,
        status: 200,
        code: "INVALID_RESPONSE",
        requestId: getPlatformRequestId(response),
        retryable: false,
        message: "HTTP 200 — Invalid announce response.",
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
      message: "HTTP 200 — Invalid announce response.",
    };
  }
}

export async function triggerRefreshCache(
  discordId: string,
  scope: string,
  timeoutMs = 8000,
): Promise<ServiceResult<RefreshCacheResponse>> {
  let response: Response;
  try {
    response = await platformRequest("/api/bot/admin/refresh-cache", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discordId, scope }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    return getNetworkFailure(error);
  }

  if (!response.ok) {
    return parseError(response, "Failed to refresh cache.");
  }

  try {
    const payload = (await response.json()) as RefreshCacheResponse;
    if (!payload?.ok || !payload.scope || !payload.refreshedAt) {
      return {
        ok: false,
        status: 200,
        code: "INVALID_RESPONSE",
        requestId: getPlatformRequestId(response),
        retryable: false,
        message: "HTTP 200 — Invalid refresh response.",
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
      message: "HTTP 200 — Invalid refresh response.",
    };
  }
}
