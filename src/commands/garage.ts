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
        opt
          .setName("car")
          .setDescription("Car name (example: 2020 Shelby GT500)")
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("pi")
          .setDescription("Class and PI (example: S1 900)")
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("power")
          .setDescription("Power and torque spec")
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName("weight").setDescription("Weight spec").setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("tire_compound")
          .setDescription("Tire compound")
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("tire_width_front")
          .setDescription("Front tire width (example: 305 mm)")
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("tire_width_rear")
          .setDescription("Rear tire width (example: 325 mm)")
          .setRequired(true),
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
      .addStringOption((opt) =>
        opt
          .setName("car")
          .setDescription("New car name (example: 2020 Shelby GT500)"),
      )
      .addStringOption((opt) =>
        opt.setName("pi").setDescription("New PI (example: S1 900)"),
      )
      .addStringOption((opt) =>
        opt.setName("power").setDescription("New power and torque spec"),
      )
      .addStringOption((opt) =>
        opt.setName("weight").setDescription("New weight spec"),
      )
      .addStringOption((opt) =>
        opt.setName("tire_compound").setDescription("New tire compound"),
      )
      .addStringOption((opt) =>
        opt.setName("tire_width_front").setDescription("New front tire width"),
      )
      .addStringOption((opt) =>
        opt.setName("tire_width_rear").setDescription("New rear tire width"),
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
    const piText = car.PI ?? "N/A";
    const powerText = car.power ?? "N/A";
    const weightText = car.weight ?? "N/A";
    const tireCompoundText = car.tireCompound ?? "N/A";
    const tireWidthFront = car.tireWidths?.front ?? "N/A";
    const tireWidthRear = car.tireWidths?.rear ?? "N/A";

    return [
      `${index + 1}. ${formatGarageCarLabel(car)} · ID: ${car.id}`,
      `PI: ${piText}`,
      `Power: ${powerText}`,
      `Weight: ${weightText}`,
      `Tire Compound: ${tireCompoundText}`,
      `Tire Widths: F ${tireWidthFront} / R ${tireWidthRear}`,
    ].join("\n");
  });

  const embed = new EmbedBuilder()
    .setTitle("Your Garage")
    .setDescription(
      lines.length > 0 ? lines.join("\n\n") : "You have no cars yet.",
    );

  await interaction.editReply({ embeds: [embed] });
}

async function handleAdd(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const car = interaction.options.getString("car", true).trim();
  const PI = interaction.options.getString("pi", true).trim();
  const power = interaction.options.getString("power", true).trim();
  const weight = interaction.options.getString("weight", true).trim();
  const tireCompound = interaction.options
    .getString("tire_compound", true)
    .trim();
  const tireWidthFront = interaction.options
    .getString("tire_width_front", true)
    .trim();
  const tireWidthRear = interaction.options
    .getString("tire_width_rear", true)
    .trim();
  const numberInput = interaction.options.getString("number");
  const number = numberInput?.trim() ? numberInput.trim() : null;

  const result = await createGarageCar({
    discordId: interaction.user.id,
    car,
    PI,
    power,
    weight,
    tireCompound,
    tireWidths: {
      front: tireWidthFront,
      rear: tireWidthRear,
    },
    number,
  });

  if (!result.ok) {
    console.error("Garage add failed", {
      status: result.status,
      code: result.code,
      retryable: result.retryable,
      requestId: result.requestId,
      discordId: interaction.user.id,
      car,
      PI,
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
  const car = interaction.options.getString("car")?.trim();
  const PI = interaction.options.getString("pi")?.trim();
  const power = interaction.options.getString("power")?.trim();
  const weight = interaction.options.getString("weight")?.trim();
  const tireCompound = interaction.options.getString("tire_compound")?.trim();
  const tireWidthFront = interaction.options
    .getString("tire_width_front")
    ?.trim();
  const tireWidthRear = interaction.options
    .getString("tire_width_rear")
    ?.trim();
  const numberInput = interaction.options.getString("number");
  const number =
    numberInput === null
      ? undefined
      : numberInput.trim().toLowerCase() === "none"
        ? null
        : numberInput.trim() || undefined;

  const tireWidths =
    tireWidthFront !== undefined || tireWidthRear !== undefined
      ? {
          front: tireWidthFront,
          rear: tireWidthRear,
        }
      : undefined;

  if (
    car === undefined &&
    PI === undefined &&
    power === undefined &&
    weight === undefined &&
    tireCompound === undefined &&
    tireWidths === undefined &&
    number === undefined
  ) {
    await interaction.editReply("Provide at least one field to update.");
    return;
  }

  const result = await updateGarageCar({
    discordId: interaction.user.id,
    carId,
    car,
    PI,
    power,
    weight,
    tireCompound,
    tireWidths,
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
