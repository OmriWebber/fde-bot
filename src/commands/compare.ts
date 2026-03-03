import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import { formatScore } from "../lib/format";
import { fetchCompare } from "../services/insights";

const data = new SlashCommandBuilder()
  .setName("compare")
  .setDescription("Compare two drivers side-by-side")
  .addStringOption((opt) =>
    opt
      .setName("driver_a")
      .setDescription("First driver (id or gamertag)")
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName("driver_b")
      .setDescription("Second driver (id or gamertag)")
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName("season_id").setDescription("Optional season id override"),
  );

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply();

  const driverA = interaction.options.getString("driver_a", true);
  const driverB = interaction.options.getString("driver_b", true);
  const seasonId = interaction.options.getString("season_id") ?? undefined;

  const result = await fetchCompare(driverA, driverB, seasonId);

  if (!result.ok) {
    console.error("Compare request failed", {
      status: result.status,
      code: result.code,
      retryable: result.retryable,
      requestId: result.requestId,
      seasonId,
      driverA,
      driverB,
    });
    await interaction.editReply(result.message);
    return;
  }

  const { season } = result.data;
  const a = result.data.driverA;
  const b = result.data.driverB;

  const embed = new EmbedBuilder()
    .setTitle(`Compare · ${season.name}`)
    .setDescription(`**${a.gamertag}** vs **${b.gamertag}**`)
    .addFields(
      {
        name: "Total Score",
        value: `${a.gamertag}: ${formatScore(a.totalScore)}\n${b.gamertag}: ${formatScore(b.totalScore)}`,
      },
      {
        name: "Avg Finish",
        value: `${a.gamertag}: ${a.avgFinish.toFixed(2)}\n${b.gamertag}: ${b.avgFinish.toFixed(2)}`,
        inline: true,
      },
      {
        name: "Podiums",
        value: `${a.gamertag}: ${a.podiums}\n${b.gamertag}: ${b.podiums}`,
        inline: true,
      },
      {
        name: "Participations",
        value: `${a.gamertag}: ${a.participations}\n${b.gamertag}: ${b.participations}`,
        inline: true,
      },
    );

  await interaction.editReply({ embeds: [embed] });
}

const command: Command = { data, execute };
export default command;
