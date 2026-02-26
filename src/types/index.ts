import type {
  Collection,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from "discord.js";

export interface Command {
  data: { name: string; toJSON(): unknown };
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}

export interface NotifyPayload {
  event: "round_open" | "results_posted" | "season_complete";
  roundId?: string;
  seasonId?: string;
}

declare module "discord.js" {
  interface Client {
    commands: Collection<string, Command>;
  }
}
