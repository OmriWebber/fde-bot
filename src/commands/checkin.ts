import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types";
import {
  resolveParticipationStatus,
  setLatestCheckin,
  submitParticipationCheckin,
} from "../services/participation";

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
    });
    await interaction.editReply(result.message);
    return;
  }

  const payload = result.data;
  const finalStatus = payload.registration.status.toUpperCase();
  const successText = `Checked in for Round/${payload.round.number} — ${payload.round.name} as ${finalStatus}.`;

  setLatestCheckin(interaction.user.id, {
    seasonName: payload.season.name,
    roundId: payload.round.id,
    roundNumber: payload.round.number,
    roundName: payload.round.name,
    status: payload.registration.status,
    checkedAt: Date.now(),
  });

  const embed = new EmbedBuilder()
    .setTitle("Participation Updated")
    .setDescription(successText)
    .setFooter({ text: payload.season.name });

  await interaction.editReply({ embeds: [embed] });
}

const command: Command = { data, execute };
export default command;
