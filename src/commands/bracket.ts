import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import { getPlatformConfig, platformRequest } from "../lib/platform";

interface ApiErrorBody {
  error?: string;
  detail?: string;
}

interface BracketResponseBody {
  bracketUrl?: string;
  round?: {
    id?: string;
    number?: number;
    name?: string;
    seasonName?: string;
  };
}

const data = new SlashCommandBuilder()
  .setName("bracket")
  .setDescription("Get a link to the live season bracket")
  .addStringOption((opt) =>
    opt
      .setName("round_id")
      .setDescription("Optional round id to fetch a specific bracket"),
  );

function getErrorMessage(
  status: number,
  payload: ApiErrorBody,
  fallback: string,
): string {
  const base = payload.error?.trim() || fallback;
  const detail = payload.detail?.trim();
  return `HTTP ${status} — ${detail ? `${base}: ${detail}` : base}`;
}

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply();

  const { secret } = getPlatformConfig();
  if (!secret) {
    await interaction.editReply("BOT_WEBHOOK_SECRET is not configured.");
    return;
  }

  const roundId = interaction.options.getString("round_id") ?? undefined;
  let response: Response;

  try {
    response = await platformRequest("/api/bot/bracket", {
      method: "GET",
      query: { roundId },
      signal: AbortSignal.timeout(8000),
    });
  } catch (error: unknown) {
    const errorName =
      typeof error === "object" && error !== null && "name" in error
        ? String((error as { name: unknown }).name)
        : "Error";

    const message =
      errorName === "TimeoutError" || errorName === "AbortError"
        ? "Request timed out while fetching bracket URL."
        : "Network error while fetching bracket URL.";

    await interaction.editReply(`HTTP 0 — ${message}`);
    return;
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    let errorMessage = `HTTP ${response.status} — Failed to fetch bracket.`;

    if (contentType.includes("application/json")) {
      try {
        const payload = (await response.json()) as ApiErrorBody;
        errorMessage = getErrorMessage(
          response.status,
          payload,
          "Failed to fetch bracket.",
        );
      } catch {
        // Keep default message
      }
    } else {
      const bodyText = await response.text().catch(() => "");
      if (bodyText.trim()) {
        errorMessage = `HTTP ${response.status} — ${bodyText.trim().slice(0, 200)}`;
      }
    }

    await interaction.editReply(errorMessage);
    return;
  }

  const payload = (await response.json()) as BracketResponseBody;
  const bracketUrl = payload.bracketUrl?.trim();
  const round = payload.round;
  const roundNumber = round?.number;
  const roundName = round?.name?.trim();
  const seasonName = round?.seasonName?.trim();
  const roundIdValue = round?.id?.trim();

  if (
    !bracketUrl ||
    typeof roundNumber !== "number" ||
    !roundName ||
    !seasonName ||
    !roundIdValue
  ) {
    await interaction.editReply(
      "HTTP 200 — Invalid response: missing bracket metadata.",
    );
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`Bracket · Round ${roundNumber}`)
    .setDescription(roundName)
    .addFields(
      { name: "Season", value: seasonName, inline: true },
      { name: "Bracket Link", value: bracketUrl },
    )
    .setURL(bracketUrl);

  await interaction.editReply({
    content: bracketUrl,
    embeds: [embed],
  });
}

const command: Command = { data, execute };
export default command;
