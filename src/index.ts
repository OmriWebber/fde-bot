import "dotenv/config";
import { Client, Collection, GatewayIntentBits } from "discord.js";
import type { Command } from "./types";

import leaderboardCommand from "./commands/leaderboard";
import profileCommand from "./commands/profile";
import roundCommand from "./commands/round";
import registerCommand from "./commands/register";
import liveryCommand from "./commands/livery";

import readyEvent from "./events/ready";
import interactionCreateEvent from "./events/interactionCreate";

import { setClient } from "./lib/notify";
import { startNotificationServer } from "./lib/server";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Register commands
client.commands = new Collection<string, Command>();
for (const command of [
  leaderboardCommand,
  profileCommand,
  roundCommand,
  registerCommand,
  liveryCommand,
]) {
  client.commands.set(command.data.name, command);
}

// Register events
client.once("ready", (...args) => {
  readyEvent.execute(...(args as Parameters<typeof readyEvent.execute>));
});

client.on("interactionCreate", (...args) => {
  void interactionCreateEvent.execute(
    ...(args as Parameters<typeof interactionCreateEvent.execute>),
  );
});

// Wire notifications and HTTP server once the bot is ready
client.once("ready", (c) => {
  setClient(c);
  startNotificationServer();
});

client.login(process.env.DISCORD_TOKEN).catch((err: unknown) => {
  console.error("Failed to login:", err);
  process.exit(1);
});
