import { CommandDefinition } from "../types";
import { SpotifyAPI } from "../client/SpotifyAPI";
import { handleSpotifyError } from "../utils/spotifyErrorHandler";
import logger from "../utils/logger";

export const command: CommandDefinition = {
  name: "previous",
  aliases: [],
  description: "Skips to the previous song in Spotify playback.",
  access: { global: 1 },
  cooldown: { user: 5, channel: 5 },
  channels: ["lsco"],
  reply: true,
  execute: async () => {
    const spotifyApi = new SpotifyAPI();

    try {
      await spotifyApi.skipToPrevious();
      return "Skipped to the previous song.";
    } catch (err: any) {
      logger.error("Error skipping to previous track:", err);
      return handleSpotifyError(err);
    }
  },
};
