import "dotenv/config";
import { REST, Routes } from "discord.js";

import leaderboardCommand from "./commands/leaderboard";
import profileCommand from "./commands/profile";
import roundCommand from "./commands/round";
import registerCommand from "./commands/register";
import liveryCommand from "./commands/livery";
import bracketCommand from "./commands/bracket";
import checkinCommand from "./commands/checkin";
import myStatusCommand from "./commands/my-status";
import seasonCommand from "./commands/season";
import scheduleCommand from "./commands/schedule";
import standingsDeltaCommand from "./commands/standings-delta";
import compareCommand from "./commands/compare";
import resultsCommand from "./commands/results";
import streaksCommand from "./commands/streaks";
import consistencyCommand from "./commands/consistency";
import xpHistoryCommand from "./commands/xp-history";
import remindersCommand from "./commands/reminders";
import announceRoundCommand from "./commands/announce-round";
import refreshCacheCommand from "./commands/refresh-cache";
import garageCommand from "./commands/garage";

async function main(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !clientId) {
    console.error("DISCORD_TOKEN and DISCORD_CLIENT_ID must be set");
    process.exit(1);
  }

  const commands = [
    leaderboardCommand,
    profileCommand,
    roundCommand,
    registerCommand,
    liveryCommand,
    bracketCommand,
    checkinCommand,
    myStatusCommand,
    seasonCommand,
    scheduleCommand,
    standingsDeltaCommand,
    compareCommand,
    resultsCommand,
    streaksCommand,
    consistencyCommand,
    xpHistoryCommand,
    remindersCommand,
    announceRoundCommand,
    refreshCacheCommand,
    garageCommand,
  ].map((c) => c.data.toJSON());

  const rest = new REST().setToken(token);

  if (guildId) {
    // Guild commands — register instantly (development)
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });
    console.info(`Registered ${commands.length} guild commands for ${guildId}`);
  } else {
    // Global commands — up to 1 hour propagation (production)
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.info(`Registered ${commands.length} global commands`);
  }
}

main().catch((err: unknown) => {
  console.error("deploy-commands failed:", err);
  process.exit(1);
});
