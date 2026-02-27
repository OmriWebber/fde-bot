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
    console.error("[bracket] BOT_WEBHOOK_SECRET is not configured");
    await interaction.editReply("BOT_WEBHOOK_SECRET is not configured.");
    return;
  }

  const roundId = interaction.options.getString("round_id") ?? undefined;

  console.info("[bracket] fetching bracket image", {
    userId: interaction.user.id,
    roundId: roundId ?? null,
  });

  const response = await platformRequest("/api/bot/bracket/image", {
    method: "GET",
    query: { roundId },
  });

  console.info("[bracket] platform response", {
    status: response.status,
    contentType: response.headers.get("content-type"),
    botErrorCode: response.headers.get("x-bot-error-code"),
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    let errorMessage = `Failed to fetch bracket (HTTP ${response.status}).`;

    if (contentType.includes("application/json")) {
      try {
        const payload = (await response.json()) as ApiErrorBody;
        console.error("[bracket] JSON error response", {
          status: response.status,
          payload,
        });
        errorMessage = getErrorMessage(response.status, payload, errorMessage);
      } catch {
        console.error("[bracket] failed to parse JSON error response", {
          status: response.status,
        });
        // Keep default message
      }
    } else {
      const bodyText = await response.text().catch(() => "");
      console.error("[bracket] text error response", {
        status: response.status,
        body: bodyText,
      });
      if (bodyText.trim()) {
        errorMessage = `${errorMessage} ${bodyText.trim().slice(0, 200)}`;
      }
    }

    await interaction.editReply(errorMessage);
    return;
  }

  const arrayBuffer = await response.arrayBuffer();
  console.info("[bracket] image fetched", {
    bytes: arrayBuffer.byteLength,
    roundId: roundId ?? null,
  });

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
