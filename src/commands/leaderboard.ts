import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import { prisma } from "../lib/db";
import { buildLeaderboardEmbed } from "../lib/embeds";

const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Show current season standings — top 10 drivers");

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const season = await prisma.season.findFirst({ where: { status: "active" } });

  if (!season) {
    await interaction.editReply("No active season found.");
    return;
  }

  const standings = await prisma.result.groupBy({
    by: ["driverId"],
    where: { round: { seasonId: season.id } },
    _sum: { score: true },
    orderBy: { _sum: { score: "desc" } },
    take: 10,
  });

  if (standings.length === 0) {
    await interaction.editReply(`No results recorded for ${season.name} yet.`);
    return;
  }

  const driverIds = standings.map((s) => s.driverId);

  const [drivers, xpTotals] = await Promise.all([
    prisma.driver.findMany({
      where: { id: { in: driverIds } },
      select: { id: true, gamertag: true },
    }),
    prisma.xpEvent.groupBy({
      by: ["driverId"],
      where: { driverId: { in: driverIds } },
      _sum: { amount: true },
    }),
  ]);

  const driverMap = new Map(drivers.map((d) => [d.id, d.gamertag]));
  const xpMap = new Map(xpTotals.map((x) => [x.driverId, x._sum.amount ?? 0]));

  const rows = standings.map((s, i) => ({
    position: i + 1,
    gamertag: driverMap.get(s.driverId) ?? "Unknown",
    totalScore: s._sum.score ?? 0,
    totalXP: xpMap.get(s.driverId) ?? 0,
  }));

  await interaction.editReply({ embeds: [buildLeaderboardEmbed(season, rows)] });
}

const command: Command = { data, execute };
export default command;
