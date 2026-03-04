import {
  ActionRowBuilder,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command } from "../types";
import {
  type ParticipationCar,
  type ParticipationCheckinSuccess,
  resolveParticipationStatus,
  setLatestCheckin,
  submitParticipationCheckin,
} from "../services/participation";

const CHECKIN_SELECT_TIMEOUT_MS = 60_000;

const data = new SlashCommandBuilder()
  .setName("checkin")
  .setDescription(
    "Mark your participation status for the current or selected round",
  )
  .addStringOption((opt) =>
    opt
      .setName("round_id")
      .setDescription("Optional round id (defaults to next active round)"),
  )
  .addStringOption((opt) =>
    opt
      .setName("status")
      .setDescription("Participation status")
      .addChoices(
        { name: "confirmed", value: "confirmed" },
        { name: "pending", value: "pending" },
        { name: "dns", value: "dns" },
        { name: "dq", value: "dq" },
      ),
  );

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const roundId = interaction.options.getString("round_id") ?? undefined;
  const statusInput = interaction.options.getString("status") ?? undefined;
  const status = resolveParticipationStatus(statusInput);

  if (!status) {
    await interaction.editReply(
      "Invalid status. Use one of: confirmed, pending, dns, dq.",
    );
    return;
  }

  const result = await submitParticipationCheckin({
    discordId: interaction.user.id,
    roundId,
    status,
  });

  if (!result.ok) {
    console.error("Participation check-in failed", {
      discordId: interaction.user.id,
      roundId,
      status,
      httpStatus: result.status,
      code: result.code,
      retryable: result.retryable,
      requestId: result.requestId,
    });
    await interaction.editReply(result.message);
    return;
  }

  const cars = result.data.cars ?? [];

  if (cars.length > 1) {
    const selectCustomId = `checkin-car:${interaction.id}`;
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(selectCustomId)
        .setPlaceholder("Select a car for this check-in")
        .addOptions(
          cars.slice(0, 25).map((car) => ({
            label: formatCarLabel(car),
            value: car.id,
            default: result.data.selectedCarId === car.id,
          })),
        ),
    );

    await interaction.editReply({
      content: "Select your car to confirm check-in.",
      embeds: [],
      components: [row],
    });

    const reply = await interaction.fetchReply();
    if (!("awaitMessageComponent" in reply)) {
      await interaction.editReply({
        content: "Could not open car selector. Please run /checkin again.",
        embeds: [],
        components: [],
      });
      return;
    }

    try {
      const selectInteraction = await (reply as Message).awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: CHECKIN_SELECT_TIMEOUT_MS,
        filter: (component) =>
          component.customId === selectCustomId &&
          component.user.id === interaction.user.id,
      });

      await selectInteraction.deferUpdate();
      const selectedCarId = selectInteraction.values[0];
      const selectedCar = cars.find((car) => car.id === selectedCarId);

      const finalResult = await submitParticipationCheckin({
        discordId: interaction.user.id,
        roundId,
        carId: selectedCarId,
        status: "confirmed",
      });

      if (!finalResult.ok) {
        console.error("Participation check-in with selected car failed", {
          discordId: interaction.user.id,
          roundId,
          status: "confirmed",
          carId: selectedCarId,
          httpStatus: finalResult.status,
          code: finalResult.code,
          retryable: finalResult.retryable,
          requestId: finalResult.requestId,
        });
        await interaction.editReply({
          content: finalResult.message,
          embeds: [],
          components: [],
        });
        return;
      }

      await completeCheckinResponse(interaction, finalResult.data, selectedCar);
      return;
    } catch {
      await interaction.editReply({
        content: "Car selection timed out. Run /checkin again.",
        embeds: [],
        components: [],
      });
      return;
    }
  }

  if (cars.length === 1) {
    const selectedCar = cars[0];
    const finalResult = await submitParticipationCheckin({
      discordId: interaction.user.id,
      roundId,
      carId: selectedCar.id,
      status,
    });

    if (!finalResult.ok) {
      console.error("Participation check-in with single car failed", {
        discordId: interaction.user.id,
        roundId,
        status,
        carId: selectedCar.id,
        httpStatus: finalResult.status,
        code: finalResult.code,
        retryable: finalResult.retryable,
        requestId: finalResult.requestId,
      });
      await interaction.editReply(finalResult.message);
      return;
    }

    await completeCheckinResponse(interaction, finalResult.data, selectedCar);
    return;
  }

  await completeCheckinResponse(interaction, result.data, undefined);
}

function formatCarLabel(car: ParticipationCar): string {
  const number = car.number ? ` #${car.number}` : "";
  return `${car.year} ${car.make} ${car.model}${number}`.slice(0, 100);
}

function completeCheckinEmbed(
  payload: ParticipationCheckinSuccess,
  selectedCar?: ParticipationCar,
): EmbedBuilder {
  const finalStatus = payload.registration.status.toUpperCase();
  const successText = selectedCar
    ? `Checked in for Round ${payload.round.number} — ${payload.round.name} as ${finalStatus}.\nCar: ${formatCarLabel(selectedCar)}`
    : `Checked in for Round ${payload.round.number} — ${payload.round.name} as ${finalStatus}.`;

  return new EmbedBuilder()
    .setTitle("Participation Updated")
    .setDescription(successText)
    .setFooter({ text: payload.season.name });
}

async function completeCheckinResponse(
  interaction: ChatInputCommandInteraction,
  payload: ParticipationCheckinSuccess,
  selectedCar?: ParticipationCar,
): Promise<void> {
  setLatestCheckin(interaction.user.id, {
    seasonName: payload.season.name,
    roundId: payload.round.id,
    roundNumber: payload.round.number,
    roundName: payload.round.name,
    status: payload.registration.status,
    checkedAt: Date.now(),
  });

  const embed = completeCheckinEmbed(payload, selectedCar);
  await interaction.editReply({ content: "", embeds: [embed], components: [] });
}

const command: Command = { data, execute };
export default command;
