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

export interface GarageCar {
  id: string;
  car?: string;
  PI?: string;
  power?: string;
  weight?: string;
  tireCompound?: string;
  tireWidths?: {
    front: string;
    rear: string;
  } | null;
  make?: string;
  model?: string;
  year?: number;
  number: string | null;
  liveryUrl?: string | null;
}

export interface GarageCarsResponse {
  cars: GarageCar[];
}

export interface GarageCarMutationResponse {
  car: GarageCar;
}

export interface CreateGarageCarInput {
  discordId: string;
  car: string;
  PI: string;
  power: string;
  weight: string;
  tireCompound: string;
  tireWidths: {
    front: string;
    rear: string;
  };
  number?: string | null;
}

export interface UpdateGarageCarInput {
  discordId: string;
  carId: string;
  car?: string;
  PI?: string;
  power?: string;
  weight?: string;
  tireCompound?: string;
  tireWidths?: {
    front?: string;
    rear?: string;
  };
  number?: string | null;
}

export interface RemoveGarageCarInput {
  discordId: string;
  carId: string;
}

export function formatGarageCarLabel(car: GarageCar): string {
  if (car.car && car.car.trim().length > 0) {
    const numberPart = car.number ? ` #${car.number}` : "";
    return `${car.car}${numberPart}`;
  }

  const numberPart = car.number ? ` #${car.number}` : "";
  const yearPart = typeof car.year === "number" ? `${car.year} ` : "";
  const makePart = car.make ?? "";
  const modelPart = car.model ? ` ${car.model}` : "";
  return `${yearPart}${makePart}${modelPart}${numberPart}`.trim();
}

export function mapGarageApiError(
  status: number,
  code: string | undefined,
  fallback: string,
  detail: string | undefined,
): string {
  if (code === "UNAUTHORIZED") {
    return "Bot authentication failed while requesting garage data.";
  }

  if (code === "DRIVER_NOT_LINKED") {
    return "Your Discord account is not linked. Use /register first.";
  }

  if (code === "CAR_NOT_OWNED") {
    return "The selected car is not in your garage.";
  }

  if (code === "CAR_NOT_FOUND") {
    return "That car could not be found.";
  }

  if (code === "INVALID_QUERY") {
    return "Invalid car data. Please review your input and try again.";
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
      ? "Request timed out while contacting garage API. Please retry."
      : "Could not reach garage API. Please retry.",
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
    message: mapGarageApiError(response.status, code, fallback, detail),
  };
}

function hasValidCarShape(car: GarageCar): boolean {
  const hasLegacyName = Boolean(
    car.make && car.model && typeof car.year === "number",
  );
  const hasSpecName = Boolean(car.car && car.car.trim().length > 0);
  return Boolean(car?.id && (hasLegacyName || hasSpecName));
}

export async function fetchGarageCars(
  discordId: string,
  timeoutMs = 8000,
): Promise<ServiceResult<GarageCarsResponse>> {
  let response: Response;

  try {
    response = await platformRequest("/api/bot/cars", {
      method: "GET",
      query: { discordId },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    return getNetworkFailure(error);
  }

  if (!response.ok) {
    return parseError(response, "Failed to fetch garage cars.");
  }

  try {
    const payload = (await response.json()) as GarageCarsResponse;
    if (
      !Array.isArray(payload?.cars) ||
      payload.cars.some((car) => !hasValidCarShape(car))
    ) {
      return {
        ok: false,
        status: 200,
        code: "INVALID_RESPONSE",
        requestId: getPlatformRequestId(response),
        retryable: false,
        message: "HTTP 200 — Invalid garage cars response.",
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
      message: "HTTP 200 — Invalid garage cars response.",
    };
  }
}

export async function createGarageCar(
  input: CreateGarageCarInput,
  timeoutMs = 8000,
): Promise<ServiceResult<GarageCarMutationResponse>> {
  let response: Response;

  try {
    response = await platformRequest("/api/bot/cars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    return getNetworkFailure(error);
  }

  if (!response.ok) {
    return parseError(response, "Failed to add car.");
  }

  try {
    const payload = (await response.json()) as GarageCarMutationResponse;
    if (!payload?.car || !hasValidCarShape(payload.car)) {
      return {
        ok: false,
        status: 200,
        code: "INVALID_RESPONSE",
        requestId: getPlatformRequestId(response),
        retryable: false,
        message: "HTTP 200 — Invalid add car response.",
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
      message: "HTTP 200 — Invalid add car response.",
    };
  }
}

export async function updateGarageCar(
  input: UpdateGarageCarInput,
  timeoutMs = 8000,
): Promise<ServiceResult<GarageCarMutationResponse>> {
  let response: Response;

  try {
    response = await platformRequest("/api/bot/cars", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    return getNetworkFailure(error);
  }

  if (!response.ok) {
    return parseError(response, "Failed to update car.");
  }

  try {
    const payload = (await response.json()) as GarageCarMutationResponse;
    if (!payload?.car || !hasValidCarShape(payload.car)) {
      return {
        ok: false,
        status: 200,
        code: "INVALID_RESPONSE",
        requestId: getPlatformRequestId(response),
        retryable: false,
        message: "HTTP 200 — Invalid update car response.",
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
      message: "HTTP 200 — Invalid update car response.",
    };
  }
}

export async function removeGarageCar(
  input: RemoveGarageCarInput,
  timeoutMs = 8000,
): Promise<ServiceResult<{ ok: true }>> {
  let response: Response;

  try {
    response = await platformRequest("/api/bot/cars", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    return getNetworkFailure(error);
  }

  if (!response.ok) {
    return parseError(response, "Failed to remove car.");
  }

  return { ok: true, data: { ok: true } };
}
