import assert from "node:assert/strict";
import test from "node:test";
import { formatGarageCarLabel, mapGarageApiError } from "./garage";

test("formatGarageCarLabel formats without number", () => {
  assert.equal(
    formatGarageCarLabel({
      id: "c1",
      make: "Nissan",
      model: "Silvia S15",
      year: 2002,
      number: null,
    }),
    "2002 Nissan Silvia S15",
  );
});

test("formatGarageCarLabel formats with number", () => {
  assert.equal(
    formatGarageCarLabel({
      id: "c2",
      make: "Mazda",
      model: "RX-7",
      year: 1999,
      number: "77",
    }),
    "1999 Mazda RX-7 #77",
  );
});

test("mapGarageApiError maps driver not linked", () => {
  assert.equal(
    mapGarageApiError(409, "DRIVER_NOT_LINKED", "Failed", undefined),
    "Your Discord account is not linked. Use /register first.",
  );
});

test("mapGarageApiError maps car not owned", () => {
  assert.equal(
    mapGarageApiError(403, "CAR_NOT_OWNED", "Failed", undefined),
    "The selected car is not in your garage.",
  );
});
