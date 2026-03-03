import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import { fetchSeasonSchedule, formatScheduleLine } from "../services/season";

const data = new SlashCommandBuilder()
  .setName("schedule")
  .setDescription("Show the current active season round schedule");

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply();

  const result = await fetchSeasonSchedule();
  if (!result.ok) {
    console.error("Season schedule request failed", {
      status: result.status,
      code: result.code,
      retryable: result.retryable,
      requestId: result.requestId,
    });
    await interaction.editReply(result.message);
    return;
  }

  const lines = result.data.rounds.slice(0, 10).map(formatScheduleLine);

  const embed = new EmbedBuilder()
    .setTitle(`Schedule · ${result.data.season.name}`)
    .setDescription(
      lines.length > 0 ? lines.join("\n") : "No rounds in schedule.",
    );

  await interaction.editReply({ embeds: [embed] });
}

const command: Command = { data, execute };
export default command;
