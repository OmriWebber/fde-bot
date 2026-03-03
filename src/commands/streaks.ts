import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import { fetchStreaks } from "../services/reliability";

const data = new SlashCommandBuilder()
  .setName("streaks")
  .setDescription("Show your participation and podium streaks")
  .addStringOption((opt) =>
    opt.setName("season_id").setDescription("Optional season id override"),
  );

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const seasonId = interaction.options.getString("season_id") ?? undefined;
  const result = await fetchStreaks(interaction.user.id, seasonId);

  if (!result.ok) {
    console.error("Streaks request failed", {
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
    .setTitle(`Streaks · ${data.driver.gamertag}`)
    .setDescription(`Season: ${data.season.name}`)
    .addFields(
      {
        name: "Participation",
        value: `Current: ${data.current.participation}\nBest: ${data.streaks.participation}`,
        inline: true,
      },
      {
        name: "Podium",
        value: `Current: ${data.current.podium}\nBest: ${data.streaks.podium}`,
        inline: true,
      },
      {
        name: "Top 10",
        value: `Current: ${data.current.top10}\nBest: ${data.streaks.top10}`,
        inline: true,
      },
    );

  await interaction.editReply({ embeds: [embed] });
}

const command: Command = { data, execute };
export default command;
