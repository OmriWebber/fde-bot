import { SlashCommandBuilder } from "discord.js";
import type {
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from "discord.js";
import type { Command } from "../types";
import { prisma } from "../lib/db";
import { buildProfileEmbed } from "../lib/embeds";

const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("Show a driver's profile")
  .addStringOption((opt) =>
    opt
      .setName("gamertag")
      .setDescription("Driver gamertag")
      .setRequired(true)
      .setAutocomplete(true),
  );

async function autocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused();
  const drivers = await prisma.driver.findMany({
    where: { gamertag: { contains: focused, mode: "insensitive" } },
    take: 25,
    select: { gamertag: true },
    orderBy: { gamertag: "asc" },
  });
  await interaction.respond(
    drivers.map((d: { gamertag: string }) => ({
      name: d.gamertag,
      value: d.gamertag,
    })),
  );
}

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply();

  const gamertag = interaction.options.getString("gamertag", true);

  const driver = await prisma.driver.findUnique({
    where: { gamertag },
    include: {
      _count: { select: { cars: true } },
      xpEvents: { select: { amount: true } },
      results: {
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          round: { select: { name: true, number: true } },
        },
      },
    },
  });

  if (!driver) {
    const platformUrl =
      process.env.PLATFORM_URL ?? "https://forzadriftevents.com";
    await interaction.editReply(
      `No driver found with gamertag **${gamertag}**. Register at ${platformUrl}/register`,
    );
    return;
  }

  const totalXP = driver.xpEvents.reduce(
    (sum: number, ev: { amount: number }) => sum + ev.amount,
    0,
  );

  await interaction.editReply({
    embeds: [buildProfileEmbed(driver, totalXP, driver.results)],
  });
}

const command: Command = { data, execute, autocomplete };
export default command;
