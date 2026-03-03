import assert from "node:assert/strict";
import test from "node:test";
import { getDeltaSymbol, mapInsightsApiError } from "./insights";

test("getDeltaSymbol returns expected symbol", () => {
  assert.equal(getDeltaSymbol(2), "↑");
  assert.equal(getDeltaSymbol(-1), "↓");
  assert.equal(getDeltaSymbol(0), "→");
});

test("mapInsightsApiError maps unauthorized", () => {
  assert.equal(
    mapInsightsApiError(
      401,
      "UNAUTHORIZED",
      "Failed to fetch data.",
      undefined,
    ),
    "Bot authentication failed while requesting insight data.",
  );
});

test("mapInsightsApiError maps invalid query", () => {
  assert.equal(
    mapInsightsApiError(
      400,
      "INVALID_QUERY",
      "Failed to fetch data.",
      undefined,
    ),
    "Invalid command input for this request.",
  );
});

test("mapInsightsApiError falls back with detail", () => {
  assert.equal(
    mapInsightsApiError(
      422,
      undefined,
      "Failed to fetch data.",
      "Missing seasonId",
    ),
    "HTTP 422 — Failed to fetch data.: Missing seasonId",
  );
});
