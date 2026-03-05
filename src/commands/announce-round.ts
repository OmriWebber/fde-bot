import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import { toDiscordTimestamp } from "../lib/format";
import { fetchActiveSeasonSummary } from "../services/season";

const data = new SlashCommandBuilder()
  .setName("announce-round")
  .setDescription("Admin: publish round announcement now")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption((opt) =>
    opt
      .setName("channel")
      .setDescription("Optional target channel override")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
  );

function hasManageGuild(interaction: ChatInputCommandInteraction): boolean {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false
  );
}

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!hasManageGuild(interaction)) {
    await interaction.editReply(
      "You need Manage Server permission for this command.",
    );
    return;
  }

  const roundResult = await fetchActiveSeasonSummary();
  if (!roundResult.ok) {
    console.error("Announce round summary fetch failed", {
      status: roundResult.status,
      code: roundResult.code,
      retryable: roundResult.retryable,
      requestId: roundResult.requestId,
      discordId: interaction.user.id,
    });
    await interaction.editReply(roundResult.message);
    return;
  }

  const nextRound = roundResult.data.nextRound;
  if (!nextRound) {
    await interaction.editReply(
      "No upcoming/live round is available to announce.",
    );
    return;
  }

  const channel = interaction.options.getChannel("channel");
  const channelId =
    channel?.id ??
    process.env.DISCORD_ROUNDS_CHANNEL_ID ??
    interaction.channelId;

  const targetChannel = await interaction.client.channels.fetch(channelId);
  if (
    !targetChannel ||
    !targetChannel.isTextBased() ||
    !("send" in targetChannel)
  ) {
    await interaction.editReply(
      `Could not resolve target text channel <#${channelId}> for announcement.`,
    );
    return;
  }

  const scheduledText = nextRound.scheduledAt
    ? toDiscordTimestamp(new Date(nextRound.scheduledAt), "F")
    : "TBD";

  const embed = new EmbedBuilder()
    .setTitle(
      `${roundResult.data.season.name} · Round ${nextRound.number} — Registration Open`,
    )
    .setDescription(
      "Registration is now open — https://forzadriftevents.com/register",
    )
    .addFields(
      { name: "Round", value: nextRound.name, inline: true },
      { name: "Scheduled", value: scheduledText, inline: true },
    )
    .setTimestamp();

  await targetChannel.send({ embeds: [embed] });

  await interaction.editReply(
    `Round announcement posted to <#${channelId}> for Round ${nextRound.number} — ${nextRound.name}.`,
  );
}

const command: Command = { data, execute };
export default command;
