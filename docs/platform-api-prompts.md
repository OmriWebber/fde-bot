# Prompts for Main Platform API Routes

Use these prompts directly with your platform engineer or coding agent to implement bot-facing routes.

---

## Prompt A — Active Season Summary Route

Implement a bot-authenticated API route:

- Method: `GET`
- Path: `/api/bot/season/summary`
- Auth: `Authorization: Bearer ${BOT_WEBHOOK_SECRET}` (fallback `x-bot-secret` accepted)

### Response (200)

```json
{
  "season": {
    "id": "...",
    "name": "Season/2",
    "status": "active",
    "roundsTotal": 8,
    "roundsComplete": 3,
    "driversRegistered": 46
  },
  "nextRound": {
    "id": "...",
    "number": 4,
    "name": "Shibuya Nights",
    "scheduledAt": "2026-03-10T19:00:00.000Z"
  }
}
```

### Behavior

- Resolve active season (`status=active`), else return 404 with code `ACTIVE_SEASON_NOT_FOUND`.
- `roundsTotal`: count all rounds in season.
- `roundsComplete`: count rounds with `status=complete`.
- `driversRegistered`: distinct drivers with active season registration.
- `nextRound`: prefer `live`, else nearest `upcoming`, else `null`.

### Error shape

```json
{ "error": "...", "detail": "...", "code": "..." }
```

Use codes: `UNAUTHORIZED`, `ACTIVE_SEASON_NOT_FOUND`, `INTERNAL_ERROR`.

---

## Prompt B — Active Season Schedule Route

Implement a bot-authenticated API route:

- Method: `GET`
- Path: `/api/bot/season/schedule`
- Auth: same as above

### Response (200)

```json
{
  "season": {
    "id": "...",
    "name": "Season/2"
  },
  "rounds": [
    {
      "id": "...",
      "number": 1,
      "name": "Akina Dawn",
      "status": "complete",
      "scheduledAt": "2026-02-01T19:00:00.000Z"
    }
  ]
}
```

### Behavior

- Resolve active season; 404 with `ACTIVE_SEASON_NOT_FOUND` if missing.
- Return season rounds ordered by `number ASC`.
- Keep response lean: only fields required by bot.

### Error shape

```json
{ "error": "...", "detail": "...", "code": "..." }
```

Use codes: `UNAUTHORIZED`, `ACTIVE_SEASON_NOT_FOUND`, `INTERNAL_ERROR`.

---

## Prompt C — Standings Delta Route (Phase 2)

Implement:

- Method: `GET`
- Path: `/api/bot/standings/delta`
- Optional query: `seasonId`

### Response (200)

```json
{
  "season": { "id": "...", "name": "Season/2" },
  "rows": [
    {
      "driverId": "...",
      "gamertag": "...",
      "currentPosition": 1,
      "previousPosition": 3,
      "delta": 2,
      "totalScore": 245.5
    }
  ],
  "sourceRound": { "id": "...", "number": 4 }
}
```

### Behavior

- Compute current standings after latest complete round.
- Compute previous standings snapshot before latest complete round.
- `delta = previousPosition - currentPosition`.

---

## Prompt D — Compare Drivers Route (Phase 2)

Implement:

- Method: `GET`
- Path: `/api/bot/compare`
- Query: `a` (driverId or gamertag), `b` (driverId or gamertag), optional `seasonId`

### Response (200)

```json
{
  "season": { "id": "...", "name": "Season/2" },
  "driverA": {
    "id": "...",
    "gamertag": "...",
    "totalScore": 210,
    "avgFinish": 3.2,
    "podiums": 2,
    "participations": 5
  },
  "driverB": {
    "id": "...",
    "gamertag": "...",
    "totalScore": 198,
    "avgFinish": 4.0,
    "podiums": 1,
    "participations": 5
  }
}
```

### Error codes

- `UNAUTHORIZED`
- `DRIVER_NOT_FOUND`
- `ACTIVE_SEASON_NOT_FOUND`
- `INVALID_QUERY`

---

## Prompt E — Round Results Route (Phase 2)

Implement:

- Method: `GET`
- Path: `/api/bot/results`
- Optional query: `roundId`

### Response (200)

```json
{
  "season": { "id": "...", "name": "Season/2" },
  "round": {
    "id": "...",
    "number": 4,
    "name": "Shibuya Nights",
    "status": "complete"
  },
  "topResults": [
    {
      "position": 1,
      "score": 96.4,
      "driver": { "id": "...", "gamertag": "DriverA" }
    }
  ]
}
```

### Behavior

- If `roundId` provided, use it.
- If omitted, resolve the latest relevant round (prefer latest complete, fallback live).
- Return top results sorted by `position ASC` (or best available order) limited for bot display.

### Error codes

- `UNAUTHORIZED`
- `ROUND_NOT_FOUND`
- `ACTIVE_SEASON_NOT_FOUND`
- `INTERNAL_ERROR`

---

## Prompt F — Streaks Route (Phase 3)

Implement:

- Method: `GET`
- Path: `/api/bot/streaks`
- Query: `discordId`, optional `seasonId`

### Response (200)

```json
{
  "driver": { "id": "...", "gamertag": "DriverA" },
  "season": { "id": "...", "name": "Season/2" },
  "streaks": { "participation": 6, "podium": 2, "top10": 6 },
  "current": { "participation": 4, "podium": 1, "top10": 4 }
}
```

### Behavior

- Resolve driver via `discordId` link.
- Use active season unless `seasonId` override is provided.
- `streaks`: best-ever streak lengths within season scope.
- `current`: currently active streak lengths at latest round.

### Error codes

- `UNAUTHORIZED`
- `DRIVER_NOT_LINKED`
- `DRIVER_NOT_FOUND`
- `ACTIVE_SEASON_NOT_FOUND`

---

## Prompt G — Consistency Route (Phase 3)

Implement:

- Method: `GET`
- Path: `/api/bot/consistency`
- Query: `discordId`, optional `seasonId`

### Response (200)

```json
{
  "driver": { "id": "...", "gamertag": "DriverA" },
  "season": { "id": "...", "name": "Season/2" },
  "stats": {
    "avgFinish": 3.2,
    "finishStdDev": 1.1,
    "participations": 5,
    "bestFinish": 1,
    "worstFinish": 6
  },
  "trend": "improving"
}
```

### Behavior

- Resolve driver by `discordId`.
- Compute aggregate finish metrics within season scope.
- `trend` should be one of: `improving`, `stable`, `declining`.

### Error codes

- `UNAUTHORIZED`
- `DRIVER_NOT_LINKED`
- `DRIVER_NOT_FOUND`
- `ACTIVE_SEASON_NOT_FOUND`

---

## Prompt H — XP History Route (Phase 3)

Implement:

- Method: `GET`
- Path: `/api/bot/xp/history`
- Query: `discordId` or `driverId`, optional `limit` (default 10)

### Response (200)

```json
{
  "driver": { "id": "...", "gamertag": "..." },
  "items": [
    {
      "id": "...",
      "type": "participation",
      "amount": 150,
      "roundId": "...",
      "createdAt": "2026-03-01T20:15:00.000Z"
    }
  ]
}
```

### Error codes

- `UNAUTHORIZED`
- `DRIVER_NOT_LINKED`
- `DRIVER_NOT_FOUND`

---

## Prompt I — Reminder Preferences Route (Phase 4)

Implement:

- Method: `GET`
- Path: `/api/bot/reminders/preferences`
- Query: `discordId`

### GET Response (200)

```json
{
  "preferences": {
    "discordId": "...",
    "reminders": { "h24": true, "h1": true, "live": true },
    "channelId": "1234567890"
  }
}
```

Implement update route:

- Method: `POST`
- Path: `/api/bot/reminders/preferences`
- Body:

```json
{
  "discordId": "...",
  "reminders": { "h24": true, "h1": false, "live": true },
  "channelId": "1234567890"
}
```

### POST Response (200)

```json
{
  "preferences": {
    "discordId": "...",
    "reminders": { "h24": true, "h1": false, "live": true },
    "channelId": "1234567890"
  }
}
```

### Error codes

- `UNAUTHORIZED`
- `DRIVER_NOT_LINKED`
- `INVALID_QUERY`
- `INTERNAL_ERROR`

---

## Prompt J — Admin Announce Round Route (Phase 4)

Implement:

- Method: `POST`
- Path: `/api/bot/admin/announce-round`
- Body:

```json
{
  "discordId": "...",
  "roundId": "optional",
  "channelId": "optional"
}
```

### Response (200)

```json
{
  "announcementId": "...",
  "channelId": "1234567890",
  "round": {
    "id": "...",
    "number": 4,
    "name": "Shibuya Nights"
  }
}
```

### Error codes

- `UNAUTHORIZED`
- `FORBIDDEN`
- `ROUND_NOT_FOUND`
- `INTERNAL_ERROR`

---

## Prompt K — Admin Refresh Cache Route (Phase 4)

Implement:

- Method: `POST`
- Path: `/api/bot/admin/refresh-cache`
- Body:

```json
{
  "discordId": "...",
  "scope": "all|season|standings|results|drivers"
}
```

### Response (200)

```json
{
  "ok": true,
  "scope": "all",
  "refreshedAt": "2026-03-03T20:10:00.000Z"
}
```

### Error codes

- `UNAUTHORIZED`
- `FORBIDDEN`
- `INVALID_QUERY`
- `INTERNAL_ERROR`

---

## Prompt L — Garage CRUD Routes

Implement bot-authenticated garage routes for Discord users:

- Base path: `/api/bot/cars`
- Auth: `Authorization: Bearer ${BOT_WEBHOOK_SECRET}` (fallback `x-bot-secret` accepted)
- All routes must resolve user by `discordId` and only allow access to that user’s own cars.

### 1) View garage cars

- Method: `GET`
- Query: `discordId`

Response (200):

```json
{
  "cars": [
    {
      "id": "...",
      "make": "Nissan",
      "model": "Silvia S15",
      "year": 2002,
      "number": "77",
      "liveryUrl": "https://..."
    }
  ]
}
```

### 2) Add car

- Method: `POST`
- Body:

```json
{
  "discordId": "...",
  "make": "Nissan",
  "model": "Silvia S15",
  "year": 2002,
  "number": "77"
}
```

Response (200):

```json
{
  "car": {
    "id": "...",
    "make": "Nissan",
    "model": "Silvia S15",
    "year": 2002,
    "number": "77",
    "liveryUrl": null
  }
}
```

### 3) Update car

- Method: `PATCH`
- Body:

```json
{
  "discordId": "...",
  "carId": "...",
  "make": "Nissan",
  "model": "Silvia S15",
  "year": 2002,
  "number": null
}
```

Rules:

- `carId` required.
- At least one mutable field (`make`, `model`, `year`, `number`) must be provided.
- `number: null` clears the number.

Response (200):

```json
{
  "car": {
    "id": "...",
    "make": "Nissan",
    "model": "Silvia S15",
    "year": 2002,
    "number": null,
    "liveryUrl": "https://..."
  }
}
```

### 4) Remove car

- Method: `DELETE`
- Body:

```json
{
  "discordId": "...",
  "carId": "..."
}
```

Response (200):

```json
{
  "ok": true
}
```

### Error shape

```json
{ "error": "...", "detail": "...", "code": "..." }
```

Use codes:

- `UNAUTHORIZED`
- `DRIVER_NOT_LINKED`
- `CAR_NOT_OWNED`
- `CAR_NOT_FOUND`
- `INVALID_QUERY`
- `INTERNAL_ERROR`
