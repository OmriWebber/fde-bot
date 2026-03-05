import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import { fetchCurrentParticipationStatus } from "../services/participation";

const data = new SlashCommandBuilder()
  .setName("my-status")
  .setDescription("Show your current round participation status");

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await fetchCurrentParticipationStatus(interaction.user.id);
  if (!result.ok) {
    console.error("My status request failed", {
      status: result.status,
      code: result.code,
      retryable: result.retryable,
      requestId: result.requestId,
      discordId: interaction.user.id,
    });
    await interaction.editReply(result.message);
    return;
  }

  const payload = result.data;
  const selectedCar = payload.cars?.find(
    (car) => car.id === payload.selectedCarId,
  );
  const selectedCarText = selectedCar
    ? `${selectedCar.year} ${selectedCar.make} ${selectedCar.model}${selectedCar.number ? ` #${selectedCar.number}` : ""}`
    : "N/A";

  const embed = new EmbedBuilder()
    .setTitle("My Current Round Status")
    .setDescription(
      `Round ${payload.round.number} — ${payload.round.name}\nStatus: **${payload.registration.status.toUpperCase()}**`,
    )
    .addFields(
      { name: "Round ID", value: payload.round.id, inline: true },
      { name: "Car", value: selectedCarText, inline: true },
    )
    .setFooter({ text: payload.season.name });

  await interaction.editReply({ embeds: [embed] });
}

const command: Command = { data, execute };
export default command;
