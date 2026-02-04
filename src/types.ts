import { PrismaClient } from "@prisma/client";
import { ApiClient } from "@twurple/api";
import { Config } from "./config";
import { ChatClient, PrivmsgMessage } from "@mastondzn/dank-twitch-irc";
import { TwitchChannel } from "./utils/twitch";

export interface CommandContext {
  client: ChatClient;
  message: PrivmsgMessage;
  config: Config;
  prisma: PrismaClient;
  isMod: boolean;
  isBroadcaster: boolean;
  isAdmin: boolean;
  apiClient: ApiClient;
  channel: TwitchChannel;
}

export interface CommandAccess {
  global?: number;
  channel?: number;
}

export interface CommandCooldown {
  global?: number;
  channel?: number;
  user?: number;
}

export interface CommandDefinition {
  name: string;
  aliases?: string[];
  description: string;
  access: CommandAccess;
  cooldown: CommandCooldown;
  reply?: boolean;
  showTyping?: boolean;
  channels?: string[];
  execute: (context: CommandContext) => Promise<string | void | null>;
}
