import { Events, MessageFlags } from "discord.js";
import type { Interaction } from "discord.js";
import type { Command } from "../types";

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
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: "Something went wrong." });
      } else {
        await interaction.reply({
          content: "Something went wrong.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};
