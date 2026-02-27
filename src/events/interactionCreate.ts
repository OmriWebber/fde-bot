import { Events, MessageFlags } from "discord.js";
import type { Interaction } from "discord.js";
import type { Command } from "../types";

function getDiscordErrorCode(error: unknown): number | string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const maybeCode = (error as { code?: number | string }).code;
  return maybeCode;
}

function isSafeToIgnoreDiscordReplyError(error: unknown): boolean {
  const code = getDiscordErrorCode(error);
  return code === 10062 || code === 40060;
}

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction): Promise<void> {
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(
        interaction.commandName,
      ) as Command | undefined;
      if (command?.autocomplete) {
        try {
          await command.autocomplete(interaction);
        } catch (err) {
          console.error(
            `Autocomplete error in ${interaction.commandName}:`,
            err,
          );
        }
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName) as
      | Command
      | undefined;

    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Command error in ${interaction.commandName}:`, err);
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: "Something went wrong." });
        } else {
          await interaction.reply({
            content: "Something went wrong.",
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (replyError) {
        if (isSafeToIgnoreDiscordReplyError(replyError)) {
          console.warn(
            `Skipped fallback reply for ${interaction.commandName} due to interaction state:`,
            replyError,
          );
          return;
        }

        throw replyError;
      }
    }
  },
};
