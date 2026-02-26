import { Events } from "discord.js";
import type { Client } from "discord.js";

export default {
  name: Events.ClientReady,
  once: true,
  execute(client: Client<true>): void {
    console.info(`Ready. Logged in as ${client.user.tag}`);
  },
};
