import "dotenv/config";
import { REST, Routes } from "discord.js";

async function main(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !clientId) {
    console.error("DISCORD_TOKEN and DISCORD_CLIENT_ID must be set");
    process.exit(1);
  }

  const rest = new REST().setToken(token);

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
    console.info(`Wiped all guild commands for ${guildId}`);
  }

  await rest.put(Routes.applicationCommands(clientId), { body: [] });
  console.info("Wiped all global commands");
}

main().catch((err: unknown) => {
  console.error("wipe-commands failed:", err);
  process.exit(1);
});
