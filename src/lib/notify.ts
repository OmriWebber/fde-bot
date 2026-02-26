import type { Client, TextChannel } from "discord.js";
import { prisma } from "./db";
import {
  buildRoundOpenEmbed,
  buildResultsPostedEmbed,
  buildSeasonCompleteEmbed,
} from "./embeds";

let _client: Client | null = null;

export function setClient(client: Client): void {
  _client = client;
}

async function getTextChannel(channelId: string): Promise<TextChannel | null> {
  if (!_client) return null;
  try {
    const channel = await _client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return null;
    return channel as TextChannel;
  } catch (err) {
    console.error(`Failed to fetch channel ${channelId}:`, err);
    return null;
  }
}

export async function notifyRoundOpen(roundId: string): Promise<void> {
  const channelId = process.env.DISCORD_ROUNDS_CHANNEL_ID;
  if (!channelId) {
    console.error("DISCORD_ROUNDS_CHANNEL_ID not set");
    return;
  }

  const round = await prisma.round.findUniqueOrThrow({
    where: { id: roundId },
    include: { season: true },
  });

  const channel = await getTextChannel(channelId);
  if (!channel) {
    console.error("Could not resolve rounds channel");
    return;
  }

  await channel.send({ embeds: [buildRoundOpenEmbed({ round })] });
}

export async function notifyResultsPosted(roundId: string): Promise<void> {
  const channelId = process.env.DISCORD_RESULTS_CHANNEL_ID;
  if (!channelId) {
    console.error("DISCORD_RESULTS_CHANNEL_ID not set");
    return;
  }

  const round = await prisma.round.findUniqueOrThrow({
    where: { id: roundId },
    include: { season: true },
  });

  const results = await prisma.result.findMany({
    where: { roundId, position: { lte: 3 } },
    orderBy: { position: "asc" },
    include: { driver: { select: { gamertag: true } } },
  });

  const xpEvents = await prisma.xpEvent.findMany({
    where: {
      roundId,
      driverId: {
        in: results.map((result: { driverId: string }) => result.driverId),
      },
    },
  });

  const xpByDriver = new Map<string, number>();
  for (const ev of xpEvents) {
    xpByDriver.set(ev.driverId, (xpByDriver.get(ev.driverId) ?? 0) + ev.amount);
  }

  const topResults = results.map(
    (result: {
      position: number | null;
      score: number;
      driver: { gamertag: string };
      driverId: string;
    }) => ({
      position: result.position,
      score: result.score,
      driver: result.driver,
      xpAwarded: xpByDriver.get(result.driverId) ?? 0,
    }),
  );

  const channel = await getTextChannel(channelId);
  if (!channel) {
    console.error("Could not resolve results channel");
    return;
  }

  await channel.send({
    embeds: [buildResultsPostedEmbed({ round, topResults })],
  });
}

export async function notifySeasonComplete(seasonId: string): Promise<void> {
  const channelId = process.env.DISCORD_GENERAL_CHANNEL_ID;
  if (!channelId) {
    console.error("DISCORD_GENERAL_CHANNEL_ID not set");
    return;
  }

  const season = await prisma.season.findUniqueOrThrow({
    where: { id: seasonId },
  });

  const standings = await prisma.result.groupBy({
    by: ["driverId"],
    where: { round: { seasonId } },
    _sum: { score: true },
    orderBy: { _sum: { score: "desc" } },
    take: 5,
  });

  const driverIds = standings.map(
    (standing: { driverId: string }) => standing.driverId,
  );
  const drivers = await prisma.driver.findMany({
    where: { id: { in: driverIds } },
    select: { id: true, gamertag: true },
  });

  const driverMap = new Map(
    drivers.map((driver: { id: string; gamertag: string }) => [
      driver.id,
      driver.gamertag,
    ]),
  );

  const top5 = standings.map(
    (
      standing: { driverId: string; _sum: { score: number | null } },
      index: number,
    ) => ({
      position: index + 1,
      gamertag: driverMap.get(standing.driverId) ?? "Unknown",
      totalScore: standing._sum.score ?? 0,
      totalXP: 0,
    }),
  );

  const [totalRounds, totalDriversResult] = await Promise.all([
    prisma.round.count({ where: { seasonId, status: "complete" } }),
    prisma.result.groupBy({
      by: ["driverId"],
      where: { round: { seasonId } },
    }),
  ]);

  const channel = await getTextChannel(channelId);
  if (!channel) {
    console.error("Could not resolve general channel");
    return;
  }

  await channel.send({
    embeds: [
      buildSeasonCompleteEmbed({
        season,
        top5,
        totalRounds,
        totalDrivers: totalDriversResult.length,
      }),
    ],
  });
}
