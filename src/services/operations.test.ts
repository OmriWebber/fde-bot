import assert from "node:assert/strict";
import test from "node:test";
import { formatReminderPreferences, mapOperationsApiError } from "./operations";

test("mapOperationsApiError maps unauthorized", () => {
  assert.equal(
    mapOperationsApiError(
      401,
      "UNAUTHORIZED",
      "Failed to fetch preferences.",
      undefined,
    ),
    "Bot authentication failed while requesting operation.",
  );
});

test("mapOperationsApiError maps forbidden", () => {
  assert.equal(
    mapOperationsApiError(
      403,
      "FORBIDDEN",
      "Failed to refresh cache.",
      undefined,
    ),
    "You do not have permission to run this operation.",
  );
});

test("formatReminderPreferences includes channel mention", () => {
  const text = formatReminderPreferences({
    discordId: "u1",
    reminders: { h24: true, h1: false, live: true },
    channelId: "12345",
  });

  assert.equal(text, "24h: ON\n1h: OFF\nLive: ON\nChannel: <#12345>");
});
