import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import { prisma } from "../lib/db";
import { buildRoundEmbed } from "../lib/embeds";

const data = new SlashCommandBuilder()
  .setName("round")
  .setDescription("Show the current or next upcoming round");

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  // Prefer live → upcoming (nearest scheduled) → most recent complete
  const round = await prisma.round.findFirst({
    where: { status: { in: ["live", "upcoming"] } },
    orderBy: [{ status: "asc" }, { scheduledAt: "asc" }],
    include: {
      season: true,
      _count: { select: { registrations: true } },
      results: {
        where: { position: { lte: 3 } },
        orderBy: { position: "asc" },
        include: { driver: { select: { gamertag: true } } },
      },
    },
  });

  if (!round) {
    // Fall back to the most recently completed round
    const lastRound = await prisma.round.findFirst({
      where: { status: "complete" },
      orderBy: { scheduledAt: "desc" },
      include: {
        season: true,
        _count: { select: { registrations: true } },
        results: {
          where: { position: { lte: 3 } },
          orderBy: { position: "asc" },
          include: { driver: { select: { gamertag: true } } },
        },
      },
    });

    if (!lastRound) {
      await interaction.editReply("No rounds found.");
      return;
    }

    await interaction.editReply({ embeds: [buildRoundEmbed(lastRound)] });
    return;
  }

  await interaction.editReply({ embeds: [buildRoundEmbed(round)] });
}

const command: Command = { data, execute };
export default command;
