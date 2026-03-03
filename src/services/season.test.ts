import assert from "node:assert/strict";
import test from "node:test";
import { formatScheduleLine, mapSeasonApiError } from "./season";

test("mapSeasonApiError maps unauthorized", () => {
  assert.equal(
    mapSeasonApiError(
      401,
      "UNAUTHORIZED",
      "Failed to fetch season summary.",
      undefined,
    ),
    "Bot authentication failed while requesting season data.",
  );
});

test("mapSeasonApiError maps no active season", () => {
  assert.equal(
    mapSeasonApiError(
      404,
      "ACTIVE_SEASON_NOT_FOUND",
      "Failed to fetch season schedule.",
      undefined,
    ),
    "No active season is currently available.",
  );
});

test("mapSeasonApiError falls back with detail", () => {
  assert.equal(
    mapSeasonApiError(
      422,
      undefined,
      "Failed to fetch season schedule.",
      "Invalid filter",
    ),
    "HTTP 422 — Failed to fetch season schedule.: Invalid filter",
  );
});

test("formatScheduleLine renders round metadata", () => {
  const line = formatScheduleLine({
    id: "r1",
    number: 4,
    name: "Shibuya Nights",
    status: "upcoming",
    scheduledAt: "2026-03-10T19:00:00.000Z",
  });

  assert.match(line, /^Round\/4 — Shibuya Nights · UPCOMING · <t:\d+:F>$/);
});
