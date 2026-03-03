import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import { fetchConsistency, getTrendLabel } from "../services/reliability";

const data = new SlashCommandBuilder()
  .setName("consistency")
  .setDescription("Show your average finish and consistency trend")
  .addStringOption((opt) =>
    opt.setName("season_id").setDescription("Optional season id override"),
  );

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const seasonId = interaction.options.getString("season_id") ?? undefined;
  const result = await fetchConsistency(interaction.user.id, seasonId);

  if (!result.ok) {
    console.error("Consistency request failed", {
      status: result.status,
      code: result.code,
      retryable: result.retryable,
      requestId: result.requestId,
      discordId: interaction.user.id,
      seasonId,
    });
    await interaction.editReply(result.message);
    return;
  }

  const data = result.data;
  const embed = new EmbedBuilder()
    .setTitle(`Consistency · ${data.driver.gamertag}`)
    .setDescription(`${data.season.name} · ${getTrendLabel(data.trend)}`)
    .addFields(
      {
        name: "Average Finish",
        value: data.stats.avgFinish.toFixed(2),
        inline: true,
      },
      {
        name: "Finish Variance",
        value: data.stats.finishStdDev.toFixed(2),
        inline: true,
      },
      {
        name: "Participations",
        value: String(data.stats.participations),
        inline: true,
      },
      {
        name: "Best Finish",
        value: `P${data.stats.bestFinish}`,
        inline: true,
      },
      {
        name: "Worst Finish",
        value: `P${data.stats.worstFinish}`,
        inline: true,
      },
    );

  await interaction.editReply({ embeds: [embed] });
}

const command: Command = { data, execute };
export default command;
