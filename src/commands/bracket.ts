import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import { getPlatformConfig, platformRequest } from "../lib/platform";

interface ApiErrorBody {
  error?: string;
  detail?: string;
}

interface BracketResponseBody {
  url?: string;
  imageUrl?: string;
}

const data = new SlashCommandBuilder()
  .setName("bracket")
  .setDescription("Get a link to the live season bracket")
  .addStringOption((opt) =>
    opt
      .setName("round_id")
      .setDescription("Optional round id to fetch a specific bracket"),
  )
  .addBooleanOption((opt) =>
    opt
      .setName("refresh")
      .setDescription("Force refresh of the bracket snapshot"),
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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { secret } = getPlatformConfig();
  if (!secret) {
    await interaction.editReply("BOT_WEBHOOK_SECRET is not configured.");
    return;
  }

  const roundId = interaction.options.getString("round_id") ?? undefined;
  const refresh = interaction.options.getBoolean("refresh") ?? false;

  const response = await platformRequest("/api/bot/bracket", {
    method: "GET",
    query: {
      roundId,
      refresh: refresh ? "1" : undefined,
    },
  });

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
  const bracketUrl = payload.url?.trim() || payload.imageUrl?.trim();

  if (!bracketUrl) {
    await interaction.editReply("HTTP 200 — Invalid response: missing url.");
    return;
  }

  await interaction.editReply({
    content: `Live bracket\n${bracketUrl}`,
  });
}

const command: Command = { data, execute };
export default command;
