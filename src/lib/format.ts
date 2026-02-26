export function getRank(xp: number): { tier: number; name: string } {
  if (xp >= 100_000) return { tier: 6, name: "Drift Legend" };
  if (xp >= 40_000) return { tier: 5, name: "Elite" };
  if (xp >= 15_000) return { tier: 4, name: "Pro Driver" };
  if (xp >= 5_000) return { tier: 3, name: "Competitor" };
  if (xp >= 1_000) return { tier: 2, name: "Club Driver" };
  return { tier: 1, name: "Rookie" };
}

export function formatScore(score: number): string {
  return score.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function formatXP(xp: number): string {
  return xp.toLocaleString("en-US");
}

export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function toDiscordTimestamp(date: Date, format: "R" | "F" = "F"): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${format}>`;
}
