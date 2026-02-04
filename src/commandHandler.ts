import fs from "fs/promises";
import path from "path";

import { CommandDefinition, CommandContext, CommandAccess } from "./types";
import prisma from "./prismaClient";
import { Config } from "./config";
import { handleCommandError } from "./utils/errorHandler";
import logger from "./utils/logger";
import { ChatClient, PrivmsgMessage } from "@mastondzn/dank-twitch-irc";
import { ApiClient } from "@twurple/api";
import { TwitchChannel } from "./utils/twitch";
import { TokenManager } from "./utils/tokenManager";

const cooldowns = {
  global: new Map<string, number>(),
  channel: new Map<string, Map<string, number>>(),
  user: new Map<string, Map<string, number>>(),
};

export class CommandHandler {
  private commands = new Map<string, CommandDefinition>();
  private aliases = new Map<string, string>();
  private chatClient: ChatClient;
  private apiClient: ApiClient;

  private config: Config;
  private commandsDir: string;

  constructor(
    chatClient: ChatClient,
    apiClient: ApiClient,
    config: Config,
    commandsDir: string = path.join(__dirname, "commands")
  ) {
    this.chatClient = chatClient;
    this.apiClient = apiClient;
    this.config = config;
    this.commandsDir = commandsDir;
  }

  async initialize(): Promise<void> {
    await this.loadCommands();
    logger.info("CommandHandler initialized and commands loaded.");
  }

  updateChatClient(newChatClient: ChatClient): void {
    this.chatClient = newChatClient;
    logger.info("CommandHandler ChatClient updated.");
  }

  async loadCommands(): Promise<void> {
    try {
      const files = await fs.readdir(this.commandsDir);
      for (const file of files) {
        if (file.endsWith(".ts") || file.endsWith(".js")) {
          const commandPath = path.join(this.commandsDir, file);
          if (process.env.NODE_ENV === "development") {
            delete require.cache[require.resolve(commandPath)];
          }
          try {
            const { command } = await import(commandPath);
            if (command && command.name && command.execute) {
              this.registerCommand(command as CommandDefinition);
            } else {
              logger.warn(
                `Could not load command from ${file}: missing name or execute function.`
              );
            }
          } catch (err) {
            logger.error(`Failed to load command file ${file}:`, err);
          }
        }
      }
      logger.info(`Loaded ${this.commands.size} commands.`);
    } catch (error) {
      logger.error("Error loading commands:", error);
    }
  }

  private registerCommand(command: CommandDefinition): void {
    if (this.commands.has(command.name)) {
      logger.warn(`Command ${command.name} is already registered. Overwriting.`);
    }

    this.commands.set(command.name, command);
    if (command.aliases) {
      for (const alias of command.aliases) {
        if (this.aliases.has(alias)) {
          logger.warn(
            `Alias ${alias} for command ${command.name} is already registered for another command. Overwriting.`
          );
        }
        this.aliases.set(alias, command.name);
      }
    }
  }

  async handleMessage(channel: string, text: string, msg: PrivmsgMessage): Promise<void> {
    if (!text.startsWith(this.config.bot.prefix)) {
      return;
    }

    const [commandNameArg, ...args] = text
      .slice(this.config.bot.prefix.length)
      .trim()
      .split(/\s+/);
    const commandName = commandNameArg.toLowerCase();

    const actualCommandName = this.aliases.get(commandName) || commandName;
    const command = this.commands.get(actualCommandName);

    if (!command) return;

    if (command.channels && command.channels.length > 0) {
      if (!command.channels.includes(channel)) {
        return;
      }
    }

    let userGlobalAccess = 0;
    let dbUser = null;
    try {
      const userPromise = prisma.user.findUnique({
        where: { id: msg.senderUserID },
        select: { permission: true },
      });
      dbUser = await userPromise;
      if (dbUser) userGlobalAccess = dbUser.permission || 0;
    } catch (dbErr) {
      logger.error("User DB lookup failed:", dbErr);
      userGlobalAccess = 0;
    }

    if (
      !this.hasAccess(
        command.access,
        userGlobalAccess,
        msg.isMod,
        msg.badges.hasVIP,
        msg.badges.hasBroadcaster
      )
    ) {
      if (command.reply) {
        await this.chatClient.reply(
          channel,
          msg.messageID,
          `You do not have permission to use this command.`
        );
      }
      return;
    }

    if (this.isOnCooldown(command, msg.senderUserID, channel, userGlobalAccess)) {
      return;
    }

    const context: CommandContext = {
      client: this.chatClient,
      message: msg,
      config: this.config,
      prisma,
      isMod: msg.isMod,
      isBroadcaster: msg.badges.hasBroadcaster,
      isAdmin: userGlobalAccess >= 1,
      apiClient: this.apiClient,
      channel: {
        id: msg.channelID,
        name: channel,
        displayName: msg.channelName,
      },
    };

    let typingPromise: Promise<void> | null = null;
    if (command.showTyping) {
      typingPromise = this.chatClient.say(channel, "Loading...").catch((err) => {
        logger.error(err);
      });
    }

    try {
      let result = await command.execute(context);
      this.setCooldown(command, msg.senderUserID, channel);

      if (command.reply && result) {
        await this.chatClient.reply(channel, msg.messageID, String(result));
      }
    } catch (error) {
      await handleCommandError(
        error,
        channel,
        this.chatClient,
        command.name,
        msg.senderUserID
      );
    } finally {
      if (typingPromise) {
        typingPromise.catch(() => {});
      }
    }
  }

  private hasAccess(
    access: CommandAccess,
    userGlobalAccess: number,
    isMod: boolean,
    isVip: boolean,
    isBroadcaster: boolean
  ): boolean {
    if (isBroadcaster) return true;
    if (access.global !== undefined && userGlobalAccess < access.global) return false;

    if (access.channel !== undefined) {
      switch (access.channel) {
        case 3:
          if (!isBroadcaster) return false;
          break;
        case 2:
          if (!isBroadcaster && !isMod) return false;
          break;
        case 1:
          if (!isBroadcaster && !isMod && !isVip) return false;
          break;
        case 0:
          break;
        default:
          return false;
      }
    }

    return true;
  }

  private isOnCooldown(
    command: CommandDefinition,
    userId: string,
    channel: string,
    permission: number
  ): boolean {
    if (permission >= 1) return false;

    const now = Date.now();

    const { global, channel: channelCd, user: userCd } = command.cooldown || {};

    if (global) {
      const globalCooldown = cooldowns.global.get(command.name);
      if (globalCooldown && now < globalCooldown) return true;
    }
    if (channelCd) {
      const channelCommandCooldowns = cooldowns.channel.get(command.name);
      if (channelCommandCooldowns) {
        const channelTimestamp = channelCommandCooldowns.get(channel);
        if (channelTimestamp && now < channelTimestamp) return true;
      }
    }
    if (userCd) {
      const userCommandCooldowns = cooldowns.user.get(command.name);
      if (userCommandCooldowns) {
        const userTimestamp = userCommandCooldowns.get(userId);
        if (userTimestamp && now < userTimestamp) return true;
      }
    }

    return false;
  }

  private setCooldown(command: CommandDefinition, userId: string, channel: string): void {
    const now = Date.now();
    const { global, channel: channelCd, user: userCd } = command.cooldown || {};

    if (global && global > 0) {
      cooldowns.global.set(command.name, now + global * 1000);
    }
    if (channelCd && channelCd > 0) {
      if (!cooldowns.channel.has(command.name)) {
        cooldowns.channel.set(command.name, new Map());
      }
      cooldowns.channel.get(command.name)!.set(channel, now + channelCd * 1000);
    }
    if (userCd && userCd > 0) {
      if (!cooldowns.user.has(command.name)) {
        cooldowns.user.set(command.name, new Map());
      }
      cooldowns.user.get(command.name)!.set(userId, now + userCd * 1000);
    }
  }

  private clearCooldown(commandName: string, userId?: string, channel?: string): void {
    cooldowns.global.delete(commandName);
    if (channel) cooldowns.channel.get(commandName)?.delete(channel);
    if (userId) cooldowns.user.get(commandName)?.delete(userId);
    logger.info(
      `Cooldowns cleared for ${commandName} (User: ${userId}, Channel: ${channel})`
    );
  }
}
