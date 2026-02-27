import { platformRequest } from "../lib/platform";

export type ParticipationStatus = "confirmed" | "pending" | "dns" | "dq";

export interface ParticipationCheckinInput {
  discordId: string;
  roundId?: string;
  status?: ParticipationStatus;
  timeoutMs?: number;
}

export interface ParticipationCheckinSuccess {
  season: {
    id: string;
    name: string;
  };
  round: {
    id: string;
    number: number;
    name: string;
  };
  driver: {
    id: string;
    gamertag?: string;
  };
  registration: {
    id: string;
    status: ParticipationStatus;
    roundId: string;
    driverId: string;
  };
}

interface ParticipationApiError {
  error?: string;
  detail?: string;
  code?: string;
}

export interface ParticipationFailure {
  ok: false;
  status: number;
  code?: string;
  message: string;
  retryable: boolean;
}

export interface ParticipationSuccess {
  ok: true;
  data: ParticipationCheckinSuccess;
}

export type ParticipationResult = ParticipationSuccess | ParticipationFailure;

export interface LatestCheckinSnapshot {
  seasonName: string;
  roundId: string;
  roundNumber: number;
  roundName: string;
  status: ParticipationStatus;
  checkedAt: number;
}

const latestCheckins = new Map<string, LatestCheckinSnapshot>();

export function resolveParticipationStatus(
  rawStatus: string | null | undefined,
): ParticipationStatus | null {
  if (!rawStatus) return "confirmed";

  if (
    rawStatus === "confirmed" ||
    rawStatus === "pending" ||
    rawStatus === "dns" ||
    rawStatus === "dq"
  ) {
    return rawStatus;
  }

  return null;
}

export function mapParticipationErrorCodeToMessage(
  status: number,
  code: string | undefined,
  fallback: string,
  detail: string | undefined,
): string {
  if (code === "SEASON_REGISTRATION_REQUIRED") {
    return "You’re not registered for the active season. Register on the website first.";
  }

  if (code === "SEASON_REGISTRATION_INACTIVE") {
    return "Your season registration is inactive. Update it on the website first.";
  }

  if (code === "DRIVER_NOT_LINKED") {
    return "Your Discord account is not linked. Use /register first.";
  }

  if (code === "ROUND_NOT_AVAILABLE") {
    return "That round is not available for check-in right now.";
  }

  if (code === "UNAUTHORIZED") {
    return "Check-in is temporarily unavailable due to bot authentication.";
  }

  if (detail && detail.trim().length > 0) {
    return `HTTP ${status} — ${fallback}: ${detail.trim()}`;
  }

  return `HTTP ${status} — ${fallback}`;
}

export function setLatestCheckin(
  discordId: string,
  value: LatestCheckinSnapshot,
): void {
  latestCheckins.set(discordId, value);
}

export function getLatestCheckin(
  discordId: string,
): LatestCheckinSnapshot | undefined {
  return latestCheckins.get(discordId);
}

export async function submitParticipationCheckin(
  input: ParticipationCheckinInput,
): Promise<ParticipationResult> {
  const status = input.status ?? "confirmed";

  let response: Response;
  try {
    response = await platformRequest("/api/bot/participation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        discordId: input.discordId,
        roundId: input.roundId,
        status,
      }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 8000),
    });
  } catch (error: unknown) {
    const errorName =
      typeof error === "object" && error !== null && "name" in error
        ? String((error as { name: unknown }).name)
        : "Error";

    const timedOut = errorName === "TimeoutError" || errorName === "AbortError";
    return {
      ok: false,
      status: 0,
      code: timedOut ? "TIMEOUT" : "NETWORK_ERROR",
      message: timedOut
        ? "Check-in request timed out. Please try again."
        : "Could not reach the platform API. Please try again.",
      retryable: true,
    };
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    let errorCode: string | undefined;
    let fallbackMessage = "Check-in failed.";
    let detail: string | undefined;

    if (contentType.includes("application/json")) {
      try {
        const payload = (await response.json()) as ParticipationApiError;
        errorCode = payload.code;
        fallbackMessage = payload.error?.trim() || fallbackMessage;
        detail = payload.detail;
      } catch {
        // keep defaults
      }
    } else {
      const text = await response.text().catch(() => "");
      if (text.trim().length > 0) {
        fallbackMessage = text.trim().slice(0, 200);
      }
    }

    return {
      ok: false,
      status: response.status,
      code: errorCode,
      message: mapParticipationErrorCodeToMessage(
        response.status,
        errorCode,
        fallbackMessage,
        detail,
      ),
      retryable: response.status >= 500,
    };
  }

  try {
    const payload = (await response.json()) as ParticipationCheckinSuccess;
    if (
      !payload ||
      !payload.season?.name ||
      !payload.round?.id ||
      typeof payload.round.number !== "number" ||
      !payload.round.name ||
      !payload.registration?.status
    ) {
      return {
        ok: false,
        status: 200,
        code: "INVALID_RESPONSE",
        message: "HTTP 200 — Invalid response from participation API.",
        retryable: false,
      };
    }

    return { ok: true, data: payload };
  } catch {
    return {
      ok: false,
      status: 200,
      code: "INVALID_RESPONSE",
      message: "HTTP 200 — Invalid response from participation API.",
      retryable: false,
    };
  }
}
