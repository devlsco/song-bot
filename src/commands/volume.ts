import { CommandDefinition } from "../types";
import { SpotifyAPI } from "../client/SpotifyAPI";
import { handleSpotifyError } from "../utils/spotifyErrorHandler";
import logger from "../utils/logger";

export const command: CommandDefinition = {
  name: "volume",
  aliases: ["vol"],
  description: "Sets the Spotify playback volume (1-100).",
  access: { global: 1 },
  cooldown: { user: 5, channel: 5 },
  channels: ["lsco"],
  reply: true,
  execute: async (context) => {
    const spotifyApi = new SpotifyAPI();
    const volumeInput = context.message.messageText.split(" ").slice(1)[0];

    if (!volumeInput) {
      return "Please specify a volume between 1 and 100.";
    }

    const volume = parseInt(volumeInput, 10);

    if (isNaN(volume) || volume < 0 || volume > 100) {
      return "Invalid volume. Please enter a number between 1 and 100.";
    }

    try {
      await spotifyApi.setVolume(volume);
      return `Volume set to ${volume}%.`;
    } catch (err: any) {
      logger.error("Error setting volume:", err);
      return handleSpotifyError(err);
    }
  },
};
