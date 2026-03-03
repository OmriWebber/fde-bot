import { EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types";
import { toDiscordTimestamp } from "../lib/format";
import { fetchActiveSeasonSummary } from "../services/season";

const data = new SlashCommandBuilder()
  .setName("season")
  .setDescription("Show active season dashboard and next round snapshot");

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply();

  const result = await fetchActiveSeasonSummary();
  if (!result.ok) {
    console.error("Season summary request failed", {
      status: result.status,
      code: result.code,
      retryable: result.retryable,
      requestId: result.requestId,
    });
    await interaction.editReply(result.message);
    return;
  }

  const summary = result.data;
  const next = summary.nextRound;
  const nextText = next
    ? `Round/${next.number} — ${next.name}`
    : "No upcoming/live round";

  const nextSchedule = next?.scheduledAt
    ? toDiscordTimestamp(new Date(next.scheduledAt), "F")
    : "TBD";

  const embed = new EmbedBuilder()
    .setTitle(`Season Dashboard · ${summary.season.name}`)
    .addFields(
      {
        name: "Progress",
        value: `${summary.season.roundsComplete}/${summary.season.roundsTotal} rounds complete`,
        inline: true,
      },
      {
        name: "Registered Drivers",
        value: String(summary.season.driversRegistered),
        inline: true,
      },
      { name: "Next Round", value: nextText },
      { name: "Next Schedule", value: nextSchedule },
    );

  await interaction.editReply({ embeds: [embed] });
}

const command: Command = { data, execute };
export default command;
