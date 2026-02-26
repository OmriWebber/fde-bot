import http from "node:http";
import type { NotifyPayload } from "../types";
import { notifyRoundOpen, notifyResultsPosted, notifySeasonComplete } from "./notify";

export function startNotificationServer(): void {
  const secret = process.env.BOT_WEBHOOK_SECRET;

  const server = http.createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/notify") {
      res.writeHead(404).end();
      return;
    }

    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
      res.writeHead(401).end();
      return;
    }

    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      let payload: NotifyPayload;
      try {
        payload = JSON.parse(body) as NotifyPayload;
      } catch {
        res.writeHead(400).end();
        return;
      }

      // Respond immediately — dispatch is fire-and-forget
      res.writeHead(200).end();

      void (async () => {
        try {
          if (payload.event === "round_open" && payload.roundId) {
            await notifyRoundOpen(payload.roundId);
          } else if (payload.event === "results_posted" && payload.roundId) {
            await notifyResultsPosted(payload.roundId);
          } else if (payload.event === "season_complete" && payload.seasonId) {
            await notifySeasonComplete(payload.seasonId);
          } else {
            console.error("Unrecognised notification payload:", payload);
          }
        } catch (err) {
          console.error("Notification handler error:", err);
        }
      })();
    });
  });

  const port = 3001;
  const host = "127.0.0.1";
  server.listen(port, host, () => {
    console.info(`Notification server listening on ${host}:${port}`);
  });
}
