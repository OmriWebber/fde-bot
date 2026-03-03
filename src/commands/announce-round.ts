import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import { triggerAnnounceRound } from "../services/operations";

const data = new SlashCommandBuilder()
  .setName("announce-round")
  .setDescription("Admin: publish round announcement now")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption((opt) =>
    opt.setName("round_id").setDescription("Optional round id override"),
  )
  .addChannelOption((opt) =>
    opt.setName("channel").setDescription("Optional target channel override"),
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

  const roundId = interaction.options.getString("round_id") ?? undefined;
  const channel = interaction.options.getChannel("channel");
  const channelId = channel?.id;

  const result = await triggerAnnounceRound(
    interaction.user.id,
    roundId,
    channelId,
  );

  if (!result.ok) {
    console.error("Announce round failed", {
      status: result.status,
      code: result.code,
      retryable: result.retryable,
      requestId: result.requestId,
      discordId: interaction.user.id,
      roundId,
      channelId,
    });
    await interaction.editReply(result.message);
    return;
  }

  const payload = result.data;
  const embed = new EmbedBuilder()
    .setTitle("Round Announcement Published")
    .setDescription(
      `Round/${payload.round.number} — ${payload.round.name}\nChannel: <#${payload.channelId}>`,
    )
    .setFooter({ text: `Announcement ID: ${payload.announcementId}` });

  await interaction.editReply({ embeds: [embed] });
}

const command: Command = { data, execute };
export default command;
