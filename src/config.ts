import dotenv from "dotenv";

dotenv.config();

let cachedConfig: Config | null = null;

interface TwitchConfig {
  clientId: string;
  clientSecret: string;
  botUsername: string;
  botUserId: string;
}

interface BotConfig {
  prefix: string;
}

export interface Config {
  databaseUrl: string;
  twitch: TwitchConfig;
  bot: BotConfig;
}

export async function getConfig(): Promise<Config> {
  const {
    DATABASE_URL,
    TWITCH_CLIENT_ID,
    TWITCH_CLIENT_SECRET,
    TWITCH_BOT_USERNAME,
    TWITCH_BOT_USER_ID,
    COMMAND_PREFIX,
  } = process.env;

  if (
    !DATABASE_URL ||
    !TWITCH_CLIENT_ID ||
    !TWITCH_CLIENT_SECRET ||
    !TWITCH_BOT_USERNAME ||
    !TWITCH_BOT_USER_ID
  ) {
    throw new Error("Unknown environment variables. Please check your .env file.");
  }

  cachedConfig = {
    databaseUrl: DATABASE_URL,
    twitch: {
      clientId: TWITCH_CLIENT_ID,
      clientSecret: TWITCH_CLIENT_SECRET,
      botUsername: TWITCH_BOT_USERNAME,
      botUserId: TWITCH_BOT_USER_ID,
    },
    bot: {
      prefix: COMMAND_PREFIX || "-",
    },
  };

  return cachedConfig;
}
