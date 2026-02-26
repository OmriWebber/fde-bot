import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import { prisma } from "../lib/db";

const data = new SlashCommandBuilder()
  .setName("register")
  .setDescription("Link your Discord account to your FDE driver profile")
  .addStringOption((opt) =>
    opt
      .setName("gamertag")
      .setDescription("Your FDE gamertag")
      .setRequired(true)
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const gamertag = interaction.options.getString("gamertag", true);
  const platformUrl = process.env.PLATFORM_URL ?? "https://forzadriftevents.com";

  const driver = await prisma.driver.findUnique({ where: { gamertag } });

  if (!driver) {
    await interaction.editReply(
      `No driver found with gamertag **${gamertag}**. Register at ${platformUrl}/register`
    );
    return;
  }

  if (driver.discordId && driver.discordId !== interaction.user.id) {
    await interaction.editReply(
      "This gamertag is already linked to a different Discord account."
    );
    return;
  }

  if (driver.discordId === interaction.user.id) {
    await interaction.editReply(
      `Your account is already linked to **${gamertag}**.`
    );
    return;
  }

  await prisma.driver.update({
    where: { id: driver.id },
    data: { discordId: interaction.user.id },
  });

  await interaction.editReply(
    `Linked to **${gamertag}**. Welcome to the platform.`
  );
}

const command: Command = { data, execute };
export default command;
