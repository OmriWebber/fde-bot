# FDE Bot Roadmap (Phase-Based)

## Phase 1 — Season Visibility (shipping now)

- `/season` dashboard (active season progress, registered drivers, next round)
- `/schedule` list (upcoming/live/complete schedule snapshots)
- API-backed (no direct DB writes for these features)

## Phase 2 — Competitive Insight

- `/standings-delta` rank movement since previous round ✅ bot command shipped
- `/compare <driverA> <driverB>` side-by-side performance card ✅ bot command shipped
- `/results <round_id>` expanded summary with podium + notable stats ✅ bot command shipped

## Phase 3 — Driver Reliability

- `/streaks` participation and podium streaks ✅ bot command shipped
- `/consistency` average finish and variance insights ✅ bot command shipped
- `/xp-history` recent XP changes with reasons ✅ bot command shipped

## Phase 4 — Notifications & Operations

- opt-in reminders (24h / 1h / live) ✅ bot command shipped (`/reminders`)
- admin-only publishing commands (`/announce-round`, `/refresh-cache`) ✅ bot commands shipped
- channel routing preferences and failure diagnostics ✅ command + error diagnostics shipped

## Implementation Principles

- Keep command handlers thin; move API logic into service modules.
- Keep all user-facing failures concise and actionable.
- Preserve API error codes in logs for incident debugging.
- Prefer idempotent API routes for retry-safe bot behavior.
