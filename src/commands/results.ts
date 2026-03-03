import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import { formatScore } from "../lib/format";
import { fetchRoundResults } from "../services/insights";

const data = new SlashCommandBuilder()
  .setName("results")
  .setDescription("Show expanded summary for a round's top results")
  .addStringOption((opt) =>
    opt
      .setName("round_id")
      .setDescription("Optional round id (defaults to latest round context)"),
  );

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply();

  const roundId = interaction.options.getString("round_id") ?? undefined;
  const result = await fetchRoundResults(roundId);

  if (!result.ok) {
    console.error("Results request failed", {
      status: result.status,
      code: result.code,
      retryable: result.retryable,
      requestId: result.requestId,
      roundId,
    });
    await interaction.editReply(result.message);
    return;
  }

  const topLines = result.data.topResults.slice(0, 5).map((entry, index) => {
    const pos = entry.position ?? index + 1;
    return `P${pos} — **${entry.driver.gamertag}** · ${formatScore(entry.score)} pts`;
  });

  const embed = new EmbedBuilder()
    .setTitle(
      `${result.data.season.name} · Round/${result.data.round.number} — ${result.data.round.name}`,
    )
    .setDescription(
      topLines.length > 0 ? topLines.join("\n") : "No results posted yet.",
    )
    .addFields({
      name: "Status",
      value: result.data.round.status.toUpperCase(),
      inline: true,
    });

  await interaction.editReply({ embeds: [embed] });
}

const command: Command = { data, execute };
export default command;
