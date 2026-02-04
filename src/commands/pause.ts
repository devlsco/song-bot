import { CommandDefinition } from "../types";
import { SpotifyAPI } from "../client/SpotifyAPI";
import { handleSpotifyError } from "../utils/spotifyErrorHandler";
import logger from "../utils/logger";

export const command: CommandDefinition = {
  name: "pause",
  aliases: [],
  description: "Pauses Spotify playback.",
  access: { global: 1 },
  cooldown: { user: 5, channel: 5 },
  channels: ["lsco"],
  reply: true,
  execute: async () => {
    const spotifyApi = new SpotifyAPI();

    try {
      await spotifyApi.pausePlayback();
      return "Spotify playback paused.";
    } catch (error) {
      logger.error("Error pausing playback:", error);
      return handleSpotifyError(error);
    }
  },
};
