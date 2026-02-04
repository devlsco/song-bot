import { ChatClient } from "@mastondzn/dank-twitch-irc";
import logger from "./logger";

export class CommandError extends Error {
  public readonly isSilent: boolean;

  constructor(message: string, silent = false) {
    super(message);
    this.name = "CommandError";
    this.isSilent = silent;
    Object.setPrototypeOf(this, CommandError.prototype);
  }
}

export async function handleCommandError(
  error: any,
  channel: string,
  chatClient: ChatClient,
  commandName?: string,
  msgId?: string
): Promise<void> {
  const reply = async (text: string) => {
    try {
      await chatClient.reply(channel, msgId ?? "", text);
    } catch (sendErr) {
      logger.error("Failed to send error message to chat:", sendErr);
    }
  };

  try {
    if (error instanceof CommandError) {
      if (!error.isSilent) {
        await reply(error.message);
      }

      logger.warn(
        `CommandError in ${channel} for command ${commandName || "N/A"}: ${error.message}`
      );
      return;
    }

    if (error instanceof Error) {
      await reply("An unexpected error occurred. Please try again later.");

      logger.error(
        `Unhandled error in ${channel} for command ${commandName || "N/A"}:`,
        error
      );
      return;
    }

    await reply("An unknown error occurred.");

    logger.error(
      `Unknown error in ${channel} for command ${commandName || "N/A"}:`,
      error
    );
  } catch (outerErr) {
    logger.error("handleCommandError TOTAL FAILURE:", outerErr);
  }
}

export function setupGlobalErrorHandlers(chatClient: ChatClient): void {
  process.on("uncaughtException", (error: Error) => {
    logger.error("UNCAUGHT EXCEPTION:", error);
  });

  process.on("unhandledRejection", (reason: any) => {
    logger.error("UNHANDLED REJECTION:", reason);
  });
}
