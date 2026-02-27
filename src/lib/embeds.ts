import { EmbedBuilder } from "discord.js";
import {
  getRank,
  formatScore,
  formatXP,
  capitalise,
  toDiscordTimestamp,
} from "./format";

export const COLOUR_RED = 0xd10020;
export const COLOUR_GOLD = 0xc49a22;

const PLATFORM_URL = process.env.PLATFORM_URL ?? "https://forzadriftevents.com";

// ─── Leaderboard ─────────────────────────────────────────────────────────────

interface StandingRow {
  position: number;
  gamertag: string;
  totalScore: number;
  totalXP: number;
}

export function buildLeaderboardEmbed(
  season: { name: string },
  rows: StandingRow[],
): EmbedBuilder {
  const lines = rows.map((r) => {
    const rank = getRank(r.totalXP);
    return `\`${String(r.position).padStart(2, " ")}.\` **${r.gamertag}** — ${formatScore(r.totalScore)} pts · ${formatXP(r.totalXP)} XP · ${rank.name}`;
  });

  return new EmbedBuilder()
    .setColor(COLOUR_GOLD)
    .setTitle(`${season.name} — Standings`)
    .setDescription(lines.join("\n") || "No results yet.")
    .setFooter({
      text: `Updated ${new Date().toUTCString()} · ${PLATFORM_URL}/leaderboard`,
    });
}

// ─── Profile ──────────────────────────────────────────────────────────────────

interface ProfileResult {
  round: { name: string; number: number };
  position: number | null;
  score: number;
}

export function buildProfileEmbed(
  driver: { gamertag: string; slug: string; _count: { cars: number } },
  totalXP: number,
  lastResults: ProfileResult[],
): EmbedBuilder {
  const rank = getRank(totalXP);
  const profileUrl = `${PLATFORM_URL}/drivers/${driver.slug}`;

  const resultLines = lastResults.map(
    (r) =>
      `Round/${r.round.number} — ${r.round.name} · P${r.position ?? "—"} · ${formatScore(r.score)} pts`,
  );

  return new EmbedBuilder()
    .setColor(COLOUR_RED)
    .setTitle(driver.gamertag)
    .setURL(profileUrl)
    .addFields(
      {
        name: "Rank",
        value: `${rank.name} (Tier ${rank.tier})`,
        inline: true,
      },
      { name: "XP", value: formatXP(totalXP), inline: true },
      { name: "Cars", value: String(driver._count.cars), inline: true },
    )
    .addFields({
      name: "Last 5 Results",
      value:
        resultLines.length > 0 ? resultLines.join("\n") : "No results yet.",
    })
    .setFooter({ text: profileUrl });
}

// ─── Round ────────────────────────────────────────────────────────────────────

interface RoundWithRelations {
  number: number;
  name: string;
  type: string;
  status: "upcoming" | "live" | "complete";
  scheduledAt: Date | null;
  venue: string | null;
  season: { name: string };
  _count: { registrations: number };
  results: Array<{
    position: number | null;
    score: number;
    driver: { gamertag: string };
  }>;
}

export function buildRoundEmbed(round: RoundWithRelations): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLOUR_RED)
    .setTitle(`${round.season.name} · Round ${round.number} — ${round.name}`)
    .addFields(
      { name: "Type", value: capitalise(round.type), inline: true },
      { name: "Status", value: capitalise(round.status), inline: true },
    );

  if (round.scheduledAt) {
    embed.addFields({
      name: "Scheduled",
      value: toDiscordTimestamp(round.scheduledAt, "F"),
      inline: true,
    });
  }

  if (round.venue) {
    embed.addFields({ name: "Venue", value: round.venue, inline: true });
  }

  if (round.status === "upcoming") {
    embed.addFields({
      name: "Registered",
      value: String(round._count.registrations),
      inline: true,
    });
  }

  if (round.status === "complete" && round.results.length > 0) {
    const podium = round.results
      .slice(0, 3)
      .map(
        (r) =>
          `P${r.position ?? "—"} — **${r.driver.gamertag}** · ${formatScore(r.score)} pts`,
      )
      .join("\n");
    embed.addFields({ name: "Podium", value: podium });
  }

  return embed;
}

// ─── Notify: Round Open ───────────────────────────────────────────────────────

interface RoundOpenData {
  round: {
    number: number;
    name: string;
    type: string;
    scheduledAt: Date | null;
    season: { name: string };
  };
}

export function buildRoundOpenEmbed({ round }: RoundOpenData): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLOUR_RED)
    .setTitle(
      `${round.season.name} · Round/${round.number} — Registration Open`,
    )
    .addFields(
      { name: "Track", value: round.name, inline: true },
      { name: "Type", value: capitalise(round.type), inline: true },
    )
    .setDescription(`Registration is now open — ${PLATFORM_URL}/register`)
    .setTimestamp();

  if (round.scheduledAt) {
    embed.addFields({
      name: "Scheduled",
      value: toDiscordTimestamp(round.scheduledAt, "F"),
      inline: true,
    });
  }

  return embed;
}

// ─── Notify: Results Posted ───────────────────────────────────────────────────

interface ResultsPostedData {
  round: { number: number; season: { name: string } };
  topResults: Array<{
    position: number | null;
    score: number;
    driver: { gamertag: string };
    xpAwarded: number;
  }>;
}

export function buildResultsPostedEmbed({
  round,
  topResults,
}: ResultsPostedData): EmbedBuilder {
  const podiumLines = topResults.map(
    (r) =>
      `P${r.position ?? "—"} — **${r.driver.gamertag}** · ${formatScore(r.score)} pts · +${formatXP(r.xpAwarded)} XP`,
  );

  return new EmbedBuilder()
    .setColor(COLOUR_GOLD)
    .setTitle(`${round.season.name} · Round/${round.number} — Results`)
    .setDescription(podiumLines.join("\n"))
    .setFooter({
      text: `Full leaderboard → ${PLATFORM_URL}/leaderboard`,
    })
    .setTimestamp();
}

// ─── Notify: Season Complete ──────────────────────────────────────────────────

interface SeasonCompleteData {
  season: { name: string };
  top5: StandingRow[];
  totalRounds: number;
  totalDrivers: number;
}

export function buildSeasonCompleteEmbed({
  season,
  top5,
  totalRounds,
  totalDrivers,
}: SeasonCompleteData): EmbedBuilder {
  const champion = top5[0];
  const standingsLines = top5.map(
    (r) =>
      `\`${String(r.position).padStart(2, " ")}.\` **${r.gamertag}** — ${formatScore(r.totalScore)} pts`,
  );

  return new EmbedBuilder()
    .setColor(COLOUR_GOLD)
    .setTitle(`Season/${season.name} — Complete`)
    .setDescription(
      champion
        ? `Season champion: **${champion.gamertag}** · ${formatScore(champion.totalScore)} pts`
        : "Season complete.",
    )
    .addFields(
      { name: "Top 5", value: standingsLines.join("\n") },
      { name: "Rounds", value: String(totalRounds), inline: true },
      { name: "Drivers", value: String(totalDrivers), inline: true },
    )
    .setFooter({ text: `${PLATFORM_URL}/leaderboard` })
    .setTimestamp();
}
