import assert from "node:assert/strict";
import test from "node:test";
import {
  formatXpHistoryLine,
  getTrendLabel,
  mapReliabilityApiError,
} from "./reliability";

test("mapReliabilityApiError maps driver not linked", () => {
  assert.equal(
    mapReliabilityApiError(
      404,
      "DRIVER_NOT_LINKED",
      "Failed to fetch streaks.",
      undefined,
    ),
    "Your Discord account is not linked. Use /register first.",
  );
});

test("mapReliabilityApiError maps unauthorized", () => {
  assert.equal(
    mapReliabilityApiError(
      401,
      "UNAUTHORIZED",
      "Failed to fetch data.",
      undefined,
    ),
    "Bot authentication failed while requesting reliability data.",
  );
});

test("getTrendLabel returns expected labels", () => {
  assert.equal(getTrendLabel("improving"), "Improving ↗");
  assert.equal(getTrendLabel("stable"), "Stable →");
  assert.equal(getTrendLabel("declining"), "Declining ↘");
});

test("formatXpHistoryLine formats event summary", () => {
  const line = formatXpHistoryLine({
    id: "x1",
    type: "participation",
    amount: 150,
    roundId: "r1",
    createdAt: "2026-03-01T20:15:00.000Z",
    reason: "Round check-in",
  });

  assert.match(line, /^\+150 XP · participation · Round check-in · <t:\d+:R>$/);
});
