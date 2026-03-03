import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import { triggerRefreshCache } from "../services/operations";

const data = new SlashCommandBuilder()
  .setName("refresh-cache")
  .setDescription("Admin: refresh platform cache for bot-facing data")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption((opt) =>
    opt
      .setName("scope")
      .setDescription("Cache scope to refresh")
      .setRequired(true)
      .addChoices(
        { name: "all", value: "all" },
        { name: "season", value: "season" },
        { name: "standings", value: "standings" },
        { name: "results", value: "results" },
        { name: "drivers", value: "drivers" },
      ),
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

  const scope = interaction.options.getString("scope", true);
  const result = await triggerRefreshCache(interaction.user.id, scope);

  if (!result.ok) {
    console.error("Refresh cache failed", {
      status: result.status,
      code: result.code,
      retryable: result.retryable,
      requestId: result.requestId,
      discordId: interaction.user.id,
      scope,
    });
    await interaction.editReply(result.message);
    return;
  }

  const payload = result.data;
  const embed = new EmbedBuilder()
    .setTitle("Cache Refreshed")
    .setDescription(`Scope: **${payload.scope}**`)
    .setFooter({ text: `Refreshed at ${payload.refreshedAt}` });

  await interaction.editReply({ embeds: [embed] });
}

const command: Command = { data, execute };
export default command;
