import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types";
import { getPlatformConfig, platformRequest } from "../lib/platform";

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

interface DiscordChoicesResponse {
  choices: Array<{
    name: string;
    value: string;
  }>;
}

type DiscordChoice = { name: string; value: string };

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
  const { secret } = getPlatformConfig();
  if (!secret) return [];
  const response = await platformRequest("/api/bot/cars", {
    method: "GET",
    query: { discordId },
  });

  if (!response.ok) return [];

  const payload = (await response.json()) as CarsResponse;
  if (!payload || !Array.isArray(payload.cars)) return [];
  return payload.cars;
}

async function fetchAutocompleteChoices(
  discordId: string,
  query: string,
): Promise<DiscordChoicesResponse["choices"]> {
  const { secret } = getPlatformConfig();
  if (!secret) return [];

  const response = await platformRequest("/api/bot/cars", {
    method: "GET",
    query: {
      discordId,
      format: "discord_choices",
      query: query || undefined,
    },
  });

  if (!response.ok) return [];

  const payload = (await response.json()) as DiscordChoicesResponse;
  if (!payload || !Array.isArray(payload.choices)) return [];

  return payload.choices
    .filter(
      (choice) =>
        typeof choice?.name === "string" && typeof choice?.value === "string",
    )
    .slice(0, 25)
    .map((choice) => ({
      name: choice.name.slice(0, 100),
      value: choice.value,
    }));
}

async function respondOnce(
  interaction: AutocompleteInteraction,
  choices: DiscordChoice[],
): Promise<void> {
  if (interaction.responded) return;

  try {
    await interaction.respond(choices);
  } catch (err) {
    const errorCode = (err as { code?: number | string })?.code;
    if (interaction.responded || errorCode === 40060) return;
    throw err;
  }
}

async function autocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused().trim();

  try {
    const choices = await fetchAutocompleteChoices(
      interaction.user.id,
      focused,
    );

    if (choices.length > 0) {
      await respondOnce(interaction, choices);
      return;
    }

    const cars = await fetchOwnedCars(interaction.user.id);
    console.log("Fetched cars:", cars);
    const fallbackChoices = cars
      .filter((car) => {
        if (!focused) return true;
        const needle = focused.toLowerCase();
        const label =
          `${car.year} ${car.make} ${car.model} ${car.number ?? ""}`.toLowerCase();
        return car.id.toLowerCase().includes(needle) || label.includes(needle);
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

    await respondOnce(interaction, fallbackChoices);
  } catch (err) {
    console.error("Livery autocomplete failed:", err);
    await respondOnce(interaction, []);
  }
}

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { secret } = getPlatformConfig();
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

  const response = await platformRequest("/api/bot/livery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    const platformErrorCode = response.headers.get("x-bot-error-code");
    const bodyText = await response.text().catch(() => "");

    if (platformErrorCode === "BOT_SECRET_MISSING") {
      await interaction.editReply(
        "Livery update is temporarily unavailable: main platform bot secret is not configured.",
      );
      return;
    }

    console.error("Failed to update livery", {
      status: response.status,
      platformErrorCode,
      body: bodyText,
    });
    await interaction.editReply(
      `Failed to update livery (HTTP ${response.status}, ${platformErrorCode}). Please try again later.`,
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
