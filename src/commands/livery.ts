import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types";

interface CarsResponse {
  cars: Array<{
    id: string;
    make: string;
    model: string;
    year: number;
    number: string | null;
    liveryUrl: string | null;
  }>;
}

const data = new SlashCommandBuilder()
  .setName("livery")
  .setDescription("Attach a livery image URL to one of your registered cars")
  .addStringOption((opt) =>
    opt
      .setName("car_id")
      .setDescription("Your car id")
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addStringOption((opt) =>
    opt
      .setName("image_url")
      .setDescription("Public http(s) URL of the livery image")
      .setRequired(true),
  );

function getConfig(): {
  platformUrl: string;
  secret: string | null;
} {
  return {
    platformUrl: process.env.PLATFORM_URL ?? "https://forzadriftevents.com",
    secret: process.env.BOT_WEBHOOK_SECRET ?? null,
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function fetchOwnedCars(
  discordId: string,
): Promise<CarsResponse["cars"]> {
  const { platformUrl, secret } = getConfig();
  if (!secret) return [];

  const url = new URL("/api/bot/cars", platformUrl);
  url.searchParams.set("discordId", discordId);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });

  if (!response.ok) return [];

  const payload = (await response.json()) as CarsResponse;
  if (!payload || !Array.isArray(payload.cars)) return [];
  return payload.cars;
}

async function autocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused().toLowerCase();

  try {
    const cars = await fetchOwnedCars(interaction.user.id);
    const choices = cars
      .filter((car) => {
        if (!focused) return true;
        const label =
          `${car.year} ${car.make} ${car.model} ${car.number ?? ""}`.toLowerCase();
        return (
          car.id.toLowerCase().includes(focused) || label.includes(focused)
        );
      })
      .slice(0, 25)
      .map((car) => {
        const numberText = car.number ? ` #${car.number}` : "";
        const name = `${car.year} ${car.make} ${car.model}${numberText}`.slice(
          0,
          100,
        );
        return { name, value: car.id };
      });

    await interaction.respond(choices);
  } catch (err) {
    console.error("Livery autocomplete failed:", err);
    await interaction.respond([]);
  }
}

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { platformUrl, secret } = getConfig();
  if (!secret) {
    await interaction.editReply("BOT_WEBHOOK_SECRET is not configured.");
    return;
  }

  const carId = interaction.options.getString("car_id", true);
  const imageUrl = interaction.options.getString("image_url", true);

  if (!isHttpUrl(imageUrl)) {
    await interaction.editReply("`image_url` must be a valid http(s) URL.");
    return;
  }

  const endpoint = new URL("/api/bot/livery", platformUrl);

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      discordId: interaction.user.id,
      carId,
      liveryUrl: imageUrl,
    }),
  });

  if (response.status === 403) {
    await interaction.editReply(
      "You can only update liveries for cars you own.",
    );
    return;
  }

  if (response.status === 409) {
    await interaction.editReply(
      "Your Discord account is not linked to an FDE driver profile yet. Use `/register` first.",
    );
    return;
  }

  if (!response.ok) {
    console.log("Failed to update livery:", response);
    await interaction.editReply(
      `Failed to update livery (HTTP ${response.status}). Please try again later.`,
    );
    return;
  }

  let savedUrl = imageUrl;
  try {
    const payload = (await response.json()) as { liveryUrl?: string };
    if (payload?.liveryUrl) savedUrl = payload.liveryUrl;
  } catch {
    // Ignore non-JSON success payloads
  }

  await interaction.editReply(
    `Livery updated for car **${carId}**.\nSaved URL: ${savedUrl}`,
  );
}

const command: Command = { data, execute, autocomplete };
export default command;
