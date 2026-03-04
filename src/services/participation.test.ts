import assert from "node:assert/strict";
import test from "node:test";
import {
  mapParticipationErrorCodeToMessage,
  resolveParticipationStatus,
} from "./participation";

test("resolveParticipationStatus defaults to confirmed", () => {
  assert.equal(resolveParticipationStatus(undefined), "confirmed");
  assert.equal(resolveParticipationStatus(null), "confirmed");
});

test("resolveParticipationStatus validates supported values", () => {
  assert.equal(resolveParticipationStatus("confirmed"), "confirmed");
  assert.equal(resolveParticipationStatus("pending"), "pending");
  assert.equal(resolveParticipationStatus("dns"), "dns");
  assert.equal(resolveParticipationStatus("dq"), "dq");
  assert.equal(resolveParticipationStatus("invalid"), null);
});

test("mapParticipationErrorCodeToMessage maps season registration required", () => {
  assert.equal(
    mapParticipationErrorCodeToMessage(
      409,
      "SEASON_REGISTRATION_REQUIRED",
      "Check-in failed.",
      undefined,
    ),
    "You’re not registered for the active season. Register on the website first.",
  );
});

test("mapParticipationErrorCodeToMessage maps unauthorized", () => {
  assert.equal(
    mapParticipationErrorCodeToMessage(
      401,
      "UNAUTHORIZED",
      "Check-in failed.",
      undefined,
    ),
    "Check-in is temporarily unavailable due to bot authentication.",
  );
});

test("mapParticipationErrorCodeToMessage maps driver car required", () => {
  assert.equal(
    mapParticipationErrorCodeToMessage(
      409,
      "DRIVER_CAR_REQUIRED",
      "Check-in failed.",
      undefined,
    ),
    "Please select one of your registered cars to complete check-in.",
  );
});

test("mapParticipationErrorCodeToMessage maps car not owned", () => {
  assert.equal(
    mapParticipationErrorCodeToMessage(
      403,
      "CAR_NOT_OWNED",
      "Check-in failed.",
      undefined,
    ),
    "The selected car is not in your garage.",
  );
});

test("mapParticipationErrorCodeToMessage falls back to HTTP + detail", () => {
  assert.equal(
    mapParticipationErrorCodeToMessage(
      422,
      undefined,
      "Check-in failed.",
      "Round has no active season",
    ),
    "HTTP 422 — Check-in failed.: Round has no active season",
  );
});
