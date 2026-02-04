import { ChatClient } from "@mastondzn/dank-twitch-irc";
import { CommandHandler } from "./commandHandler";
import prisma from "./prismaClient";
import { setupGlobalErrorHandlers } from "./utils/errorHandler";
import logger from "./utils/logger";
import { getConfig, Config } from "./config";
import { getTwitchUsersByIds } from "./utils/twitch";
import { ApiClient } from "@twurple/api";
import { RefreshingAuthProvider } from "@twurple/auth";
import { SpotifyAPI } from "./client/SpotifyAPI";
import { TokenManager } from "./utils/tokenManager";

class TwitchBot {
  private chatClient?: ChatClient;
  private commandHandler?: CommandHandler;
  private config!: Config;
  private apiClient?: ApiClient;
  private spotifyApi?: SpotifyAPI;
  private tokenManager?: TokenManager;
  private authProvider?: RefreshingAuthProvider;
  private isReconnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 5000;

  public async start(): Promise<void> {
    logger.info("Starting Twitch Bot...");

    try {
      await this.connectDatabase();
      await this.initializeClients();
      await this.initializeServices();
      this.setupChatHandlers();
      await this.connectToChat();
      await this.updateAndJoinChannels();

      logger.info("Bot started successfully.");
    } catch (error) {
      throw error;
    }
  }

  private async connectDatabase(): Promise<void> {
    try {
      await prisma.$connect();
      logger.info("Connected to database.");
    } catch (error) {
      logger.error("Database connection failed:", error);
      throw error;
    }
  }

  private async initializeClients(): Promise<void> {
    this.config = await getConfig();

    this.tokenManager = new TokenManager(
      this.config.twitch.clientId,
      this.config.twitch.clientSecret,
      this.config.twitch.botUserId
    );

    this.authProvider = await this.tokenManager.initialize();

    const accessToken = await this.tokenManager.getAccessToken();

    this.chatClient = new ChatClient({
      username: this.config.twitch.botUsername!,
      password: accessToken,
      rateLimits: "verifiedBot",
    });

    setupGlobalErrorHandlers(this.chatClient);

    this.tokenManager.onTokenRefresh(async (newAccessToken) => {
      if (this.chatClient) {
        logger.info("Token refreshed, reconnecting ChatClient...");
        await this.reconnect(true);
      }
    });

    this.apiClient = new ApiClient({ authProvider: this.authProvider });
    this.spotifyApi = new SpotifyAPI();
  }

  private async initializeServices(): Promise<void> {
    if (!this.chatClient) {
      throw new Error("Client initialization failed.");
    }

    this.commandHandler = new CommandHandler(
      this.chatClient,
      this.apiClient!,
      this.config
    );

    await this.commandHandler.initialize();
    logger.info("Command handler ready.");
  }

  private setupChatHandlers(): void {
    if (!this.chatClient || !this.commandHandler) return;

    this.chatClient.on("PRIVMSG", async (msg) => {
      logger.info(`[${msg.channelName}] ${msg.senderUsername}: ${msg.messageText}`);

      try {
        await this.commandHandler?.handleMessage(msg.channelName, msg.messageText, msg);
      } catch (err) {
        logger.error("Message handling failed:", err);
      }
    });

    this.chatClient.on("connect", () => {
      logger.info("Connected to Twitch chat.");
    });

    this.chatClient.on("close", () => {
      logger.warn("Disconnected from Twitch chat. Attempting to reconnect...");
      // Automatisch reconnecten nach Disconnect
      this.reconnect().catch((err) => {
        logger.error("Failed to reconnect after disconnect:", err);
      });
    });
  }

  private async connectToChat(): Promise<void> {
    try {
      await this.chatClient?.connect();
      logger.info("Chat client connected.");
    } catch (error) {
      logger.error("Failed to connect to chat:", error);
      throw error;
    }
  }

  private async updateAndJoinChannels(): Promise<void> {
    const activeDbChannels = await prisma.channel.findMany({
      select: { id: true, name: true },
    });

    if (!this.tokenManager) {
      throw new Error("TokenManager not initialized");
    }

    const twitchUsers = await getTwitchUsersByIds(
      activeDbChannels.map((ch: { id: string; name: string }) => ch.id),
      () => this.tokenManager!.getAccessToken(),
      this.config.twitch.clientId
    );
    const twitchUsersMap = new Map(twitchUsers.map((user) => [user.id, user]));

    const channelsToJoin: string[] = [];
    const updates: Promise<any>[] = [];

    for (const dbChannel of activeDbChannels) {
      const twitchUser = twitchUsersMap.get(dbChannel.id);
      if (twitchUser) {
        if (dbChannel.name !== twitchUser.login) {
          updates.push(
            prisma.channel.update({
              where: { id: dbChannel.id },
              data: { name: twitchUser.login, active: true },
            })
          );
          logger.info(
            `Updated channel name for ID ${dbChannel.id} from ${dbChannel.name} to ${twitchUser.login}`
          );
        }
        channelsToJoin.push(twitchUser.login);
      } else {
        updates.push(
          prisma.channel.update({
            where: { id: dbChannel.id },
            data: { active: false },
          })
        );
        logger.warn(
          `Channel with ID ${dbChannel.id} not found on Twitch. Setting active to false.`
        );
      }
    }

    await Promise.all(updates);

    if (channelsToJoin.length > 0) {
      logger.info(`Joining ${channelsToJoin.length} channels`);
      await this.chatClient?.joinAll(channelsToJoin);
    } else {
      logger.info("No active channels to join.");
    }
  }

  private async reconnect(isTokenRefresh: boolean = false): Promise<void> {
    if (this.isReconnecting) {
      logger.debug("Reconnect already in progress, skipping...");
      return;
    }

    if (!isTokenRefresh) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        logger.error(
          `Max reconnect attempts (${this.maxReconnectAttempts}) reached. Stopping reconnection.`
        );
        return;
      }
      this.reconnectAttempts++;
    }

    this.isReconnecting = true;

    try {
      logger.info(
        isTokenRefresh
          ? "Reconnecting due to token refresh..."
          : `Reconnecting attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`
      );

      if (!isTokenRefresh) {
        const delay = Math.min(
          this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
          60000
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      if (!this.tokenManager) {
        throw new Error("TokenManager not initialized");
      }

      const accessToken = await this.tokenManager.getAccessToken();

      this.chatClient = new ChatClient({
        username: this.config.twitch.botUsername!,
        password: accessToken,
        rateLimits: "verifiedBot",
      });

      setupGlobalErrorHandlers(this.chatClient);

      if (this.commandHandler) {
        this.commandHandler.updateChatClient(this.chatClient);
      }

      this.setupChatHandlers();

      await this.chatClient.connect();
      logger.info("Successfully reconnected to Twitch chat.");

      await this.updateAndJoinChannels();

      if (!isTokenRefresh) {
        this.reconnectAttempts = 0;
      }
      this.isReconnecting = false;
    } catch (error) {
      this.isReconnecting = false;
      logger.error(`Reconnect attempt ${this.reconnectAttempts} failed:`, error);

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        logger.info(`Retrying reconnect in ${this.reconnectDelay / 1000} seconds...`);
        setTimeout(() => {
          this.reconnect().catch((err) => {
            logger.error("Failed to retry reconnect:", err);
          });
        }, this.reconnectDelay);
      } else {
        logger.error(
          "Max reconnect attempts reached. Bot will not automatically reconnect."
        );
      }
    }
  }
}

async function main() {
  const bot = new TwitchBot();

  try {
    await bot.start();
    process.stdin.resume();
  } catch (err) {
    logger.error("Error in main:", err);
    process.exit(1);
  }
}

export { TwitchBot };

if (require.main === module) {
  main();
}
