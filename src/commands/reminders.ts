import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import {
  fetchReminderPreferences,
  formatReminderPreferences,
  updateReminderPreferences,
} from "../services/operations";

const data = new SlashCommandBuilder()
  .setName("reminders")
  .setDescription("View or update your reminder preferences")
  .addSubcommand((sub) =>
    sub
      .setName("view")
      .setDescription("View your current reminder preferences"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Update your reminder preferences")
      .addBooleanOption((opt) =>
        opt.setName("h24").setDescription("Enable 24-hour reminders"),
      )
      .addBooleanOption((opt) =>
        opt.setName("h1").setDescription("Enable 1-hour reminders"),
      )
      .addBooleanOption((opt) =>
        opt.setName("live").setDescription("Enable live reminders"),
      )
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Optional custom reminder channel")
          .addChannelTypes(ChannelType.GuildText),
      ),
  );

async function handleView(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const result = await fetchReminderPreferences(interaction.user.id);
  if (!result.ok) {
    console.error("Reminder view failed", {
      status: result.status,
      code: result.code,
      retryable: result.retryable,
      requestId: result.requestId,
      discordId: interaction.user.id,
    });
    await interaction.editReply(result.message);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("Reminder Preferences")
    .setDescription(formatReminderPreferences(result.data.preferences));

  await interaction.editReply({ embeds: [embed] });
}

async function handleSet(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const current = await fetchReminderPreferences(interaction.user.id);
  if (!current.ok) {
    console.error("Reminder fetch before set failed", {
      status: current.status,
      code: current.code,
      retryable: current.retryable,
      requestId: current.requestId,
      discordId: interaction.user.id,
    });
    await interaction.editReply(current.message);
    return;
  }

  const h24 =
    interaction.options.getBoolean("h24") ??
    current.data.preferences.reminders.h24;
  const h1 =
    interaction.options.getBoolean("h1") ??
    current.data.preferences.reminders.h1;
  const live =
    interaction.options.getBoolean("live") ??
    current.data.preferences.reminders.live;
  const channel = interaction.options.getChannel("channel");
  const channelId = channel ? channel.id : current.data.preferences.channelId;

  const updated = await updateReminderPreferences({
    discordId: interaction.user.id,
    reminders: { h24, h1, live },
    channelId,
  });

  if (!updated.ok) {
    console.error("Reminder set failed", {
      status: updated.status,
      code: updated.code,
      retryable: updated.retryable,
      requestId: updated.requestId,
      discordId: interaction.user.id,
      channelId,
    });
    await interaction.editReply(updated.message);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("Reminder Preferences Updated")
    .setDescription(formatReminderPreferences(updated.data.preferences));

  await interaction.editReply({ embeds: [embed] });
}

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const sub = interaction.options.getSubcommand();
  if (sub === "view") {
    await handleView(interaction);
    return;
  }

  await handleSet(interaction);
}

const command: Command = { data, execute };
export default command;
