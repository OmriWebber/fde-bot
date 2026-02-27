import { AttachmentBuilder, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import { getPlatformConfig, platformRequest } from "../lib/platform";

interface ApiErrorBody {
  error?: string;
  detail?: string;
}

const data = new SlashCommandBuilder()
  .setName("bracket")
  .setDescription("Post the current season bracket snapshot")
  .addStringOption((opt) =>
    opt
      .setName("round_id")
      .setDescription("Optional round id to fetch a specific bracket"),
  );

function getErrorMessage(
  status: number,
  payload: ApiErrorBody,
  fallbackText: string,
): string {
  const base = payload.error?.trim() || fallbackText;
  const detail = payload.detail?.trim();
  return detail ? `${base}: ${detail}` : base;
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

  const response = await platformRequest("/api/bot/bracket/image", {
    method: "GET",
    query: { roundId },
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    let errorMessage = `Failed to fetch bracket (HTTP ${response.status}).`;

    if (contentType.includes("application/json")) {
      try {
        const payload = (await response.json()) as ApiErrorBody;
        errorMessage = getErrorMessage(response.status, payload, errorMessage);
      } catch {
        // Keep default message
      }
    } else {
      const bodyText = await response.text().catch(() => "");
      if (bodyText.trim()) {
        errorMessage = `${errorMessage} ${bodyText.trim().slice(0, 200)}`;
      }
    }

    await interaction.editReply(errorMessage);
    return;
  }

  const arrayBuffer = await response.arrayBuffer();
  const file = new AttachmentBuilder(Buffer.from(arrayBuffer), {
    name: "bracket.png",
  });

  await interaction.editReply({
    content: "Season bracket snapshot",
    files: [file],
  });
}

const command: Command = { data, execute };
export default command;
