import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import { getLatestCheckin } from "../services/participation";

const data = new SlashCommandBuilder()
  .setName("my-status")
  .setDescription(
    "Show your latest participation check-in status in this bot session",
  );

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const latest = getLatestCheckin(interaction.user.id);
  if (!latest) {
    await interaction.editReply(
      "No recent check-in found in this session. Run /checkin first.",
    );
    return;
  }

  const ageSeconds = Math.max(
    0,
    Math.floor((Date.now() - latest.checkedAt) / 1000),
  );

  const embed = new EmbedBuilder()
    .setTitle("My Latest Check-in")
    .setDescription(
      `Round/${latest.roundNumber} — ${latest.roundName}\nStatus: **${latest.status.toUpperCase()}**`,
    )
    .addFields(
      { name: "Round ID", value: latest.roundId, inline: true },
      { name: "Updated", value: `${ageSeconds}s ago`, inline: true },
    )
    .setFooter({ text: latest.seasonName });

  await interaction.editReply({ embeds: [embed] });
}

const command: Command = { data, execute };
export default command;
