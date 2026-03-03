import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import { fetchXpHistory, formatXpHistoryLine } from "../services/reliability";

const data = new SlashCommandBuilder()
  .setName("xp-history")
  .setDescription("Show your recent XP event history")
  .addIntegerOption((opt) =>
    opt
      .setName("limit")
      .setDescription("How many entries to show (1-20)")
      .setMinValue(1)
      .setMaxValue(20),
  );

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const limit = interaction.options.getInteger("limit") ?? 10;
  const result = await fetchXpHistory(interaction.user.id, limit);

  if (!result.ok) {
    console.error("XP history request failed", {
      status: result.status,
      code: result.code,
      retryable: result.retryable,
      requestId: result.requestId,
      discordId: interaction.user.id,
      limit,
    });
    await interaction.editReply(result.message);
    return;
  }

  const lines = result.data.items.slice(0, limit).map(formatXpHistoryLine);

  const embed = new EmbedBuilder()
    .setTitle(`XP History · ${result.data.driver.gamertag}`)
    .setDescription(
      lines.length > 0 ? lines.join("\n") : "No XP events found.",
    );

  await interaction.editReply({ embeds: [embed] });
}

const command: Command = { data, execute };
export default command;
