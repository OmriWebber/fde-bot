import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import { formatScore } from "../lib/format";
import { fetchStandingsDelta, getDeltaSymbol } from "../services/insights";

const data = new SlashCommandBuilder()
  .setName("standings-delta")
  .setDescription("Show rank movement since the previous completed round")
  .addStringOption((opt) =>
    opt.setName("season_id").setDescription("Optional season id override"),
  );

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply();

  const seasonId = interaction.options.getString("season_id") ?? undefined;
  const result = await fetchStandingsDelta(seasonId);

  if (!result.ok) {
    console.error("Standings delta request failed", {
      status: result.status,
      code: result.code,
      retryable: result.retryable,
      requestId: result.requestId,
      seasonId,
    });
    await interaction.editReply(result.message);
    return;
  }

  const rows = result.data.rows.slice(0, 10);
  const lines = rows.map((row) => {
    const symbol = getDeltaSymbol(row.delta);
    const previous = row.previousPosition ?? row.currentPosition;
    return `${symbol} **${row.gamertag}** · P${previous} → P${row.currentPosition} · ${formatScore(row.totalScore)} pts`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`Standings Delta · ${result.data.season.name}`)
    .setDescription(
      lines.length > 0
        ? lines.join("\n")
        : "No standings delta data available.",
    )
    .setFooter({
      text: `After Round ${result.data.sourceRound.number}`,
    });

  await interaction.editReply({ embeds: [embed] });
}

const command: Command = { data, execute };
export default command;
