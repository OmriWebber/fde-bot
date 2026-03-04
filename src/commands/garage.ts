import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types";
import {
  createGarageCar,
  fetchGarageCars,
  formatGarageCarLabel,
  removeGarageCar,
  updateGarageCar,
} from "../services/garage";

type DiscordChoice = { name: string; value: string };

const data = new SlashCommandBuilder()
  .setName("garage")
  .setDescription("View and manage your registered garage cars")
  .addSubcommand((sub) =>
    sub.setName("view").setDescription("View all cars in your garage"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add a new car to your garage")
      .addStringOption((opt) =>
        opt.setName("make").setDescription("Car make").setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName("model").setDescription("Car model").setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName("year")
          .setDescription("Car production year")
          .setRequired(true)
          .setMinValue(1950)
          .setMaxValue(2100),
      )
      .addStringOption((opt) =>
        opt.setName("number").setDescription("Optional driver number"),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("update")
      .setDescription("Update an existing car in your garage")
      .addStringOption((opt) =>
        opt
          .setName("car_id")
          .setDescription("Car id to update")
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addStringOption((opt) => opt.setName("make").setDescription("New make"))
      .addStringOption((opt) =>
        opt.setName("model").setDescription("New model"),
      )
      .addIntegerOption((opt) =>
        opt
          .setName("year")
          .setDescription("New year")
          .setMinValue(1950)
          .setMaxValue(2100),
      )
      .addStringOption((opt) =>
        opt
          .setName("number")
          .setDescription("New number (use 'none' to clear)"),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove a car from your garage")
      .addStringOption((opt) =>
        opt
          .setName("car_id")
          .setDescription("Car id to remove")
          .setRequired(true)
          .setAutocomplete(true),
      ),
  );

async function respondOnce(
  interaction: AutocompleteInteraction,
  choices: DiscordChoice[],
): Promise<void> {
  if (interaction.responded) return;

  try {
    await interaction.respond(choices);
  } catch (error) {
    const errorCode = (error as { code?: number | string })?.code;
    if (interaction.responded || errorCode === 40060) return;
    throw error;
  }
}

async function autocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focusedOption = interaction.options.getFocused(true);
  if (focusedOption.name !== "car_id") {
    await respondOnce(interaction, []);
    return;
  }

  try {
    const lookup = focusedOption.value.trim().toLowerCase();
    const carsResult = await fetchGarageCars(interaction.user.id);
    if (!carsResult.ok) {
      await respondOnce(interaction, []);
      return;
    }

    const choices = carsResult.data.cars
      .filter((car) => {
        if (!lookup) return true;
        const label = formatGarageCarLabel(car).toLowerCase();
        return car.id.toLowerCase().includes(lookup) || label.includes(lookup);
      })
      .slice(0, 25)
      .map((car) => ({
        name: formatGarageCarLabel(car).slice(0, 100),
        value: car.id,
      }));

    await respondOnce(interaction, choices);
  } catch (error) {
    console.error("Garage autocomplete failed", error);
    await respondOnce(interaction, []);
  }
}

async function handleView(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const result = await fetchGarageCars(interaction.user.id);
  if (!result.ok) {
    console.error("Garage view failed", {
      status: result.status,
      code: result.code,
      retryable: result.retryable,
      requestId: result.requestId,
      discordId: interaction.user.id,
    });
    await interaction.editReply(result.message);
    return;
  }

  const lines = result.data.cars.map((car, index) => {
    return `${index + 1}. ${formatGarageCarLabel(car)} · ID: ${car.id}`;
  });

  const embed = new EmbedBuilder()
    .setTitle("Your Garage")
    .setDescription(
      lines.length > 0 ? lines.join("\n") : "You have no cars yet.",
    );

  await interaction.editReply({ embeds: [embed] });
}

async function handleAdd(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const make = interaction.options.getString("make", true).trim();
  const model = interaction.options.getString("model", true).trim();
  const year = interaction.options.getInteger("year", true);
  const numberInput = interaction.options.getString("number");
  const number = numberInput?.trim() ? numberInput.trim() : null;

  const result = await createGarageCar({
    discordId: interaction.user.id,
    make,
    model,
    year,
    number,
  });

  if (!result.ok) {
    console.error("Garage add failed", {
      status: result.status,
      code: result.code,
      retryable: result.retryable,
      requestId: result.requestId,
      discordId: interaction.user.id,
      make,
      model,
      year,
    });
    await interaction.editReply(result.message);
    return;
  }

  await interaction.editReply(
    `Car added: **${formatGarageCarLabel(result.data.car)}**`,
  );
}

async function handleUpdate(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const carId = interaction.options.getString("car_id", true);
  const make = interaction.options.getString("make")?.trim();
  const model = interaction.options.getString("model")?.trim();
  const year = interaction.options.getInteger("year") ?? undefined;
  const numberInput = interaction.options.getString("number");
  const number =
    numberInput === null
      ? undefined
      : numberInput.trim().toLowerCase() === "none"
        ? null
        : numberInput.trim() || undefined;

  if (
    make === undefined &&
    model === undefined &&
    year === undefined &&
    number === undefined
  ) {
    await interaction.editReply(
      "Provide at least one field to update: make, model, year, or number.",
    );
    return;
  }

  const result = await updateGarageCar({
    discordId: interaction.user.id,
    carId,
    make,
    model,
    year,
    number,
  });

  if (!result.ok) {
    console.error("Garage update failed", {
      status: result.status,
      code: result.code,
      retryable: result.retryable,
      requestId: result.requestId,
      discordId: interaction.user.id,
      carId,
    });
    await interaction.editReply(result.message);
    return;
  }

  await interaction.editReply(
    `Car updated: **${formatGarageCarLabel(result.data.car)}**`,
  );
}

async function handleRemove(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const carId = interaction.options.getString("car_id", true);

  const result = await removeGarageCar({
    discordId: interaction.user.id,
    carId,
  });

  if (!result.ok) {
    console.error("Garage remove failed", {
      status: result.status,
      code: result.code,
      retryable: result.retryable,
      requestId: result.requestId,
      discordId: interaction.user.id,
      carId,
    });
    await interaction.editReply(result.message);
    return;
  }

  await interaction.editReply(`Removed car with id **${carId}**.`);
}

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const subcommand = interaction.options.getSubcommand();
  if (subcommand === "view") {
    await handleView(interaction);
    return;
  }

  if (subcommand === "add") {
    await handleAdd(interaction);
    return;
  }

  if (subcommand === "update") {
    await handleUpdate(interaction);
    return;
  }

  await handleRemove(interaction);
}

const command: Command = { data, execute, autocomplete };
export default command;
