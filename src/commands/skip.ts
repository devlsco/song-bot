import { CommandDefinition } from "../types";
import { SpotifyAPI } from "../client/SpotifyAPI";
import { handleSpotifyError } from "../utils/spotifyErrorHandler";
import logger from "../utils/logger";

export const command: CommandDefinition = {
  name: "skip",
  aliases: ["next"],
  description: "Skips to the next song in Spotify playback.",
  access: { global: 1 },
  cooldown: { user: 5, channel: 5 },
  channels: ["lsco"],
  reply: true,
  execute: async () => {
    const spotifyApi = new SpotifyAPI();

    try {
      await spotifyApi.skipToNext();
      return "Skipped to the next song.";
    } catch (err: any) {
      logger.error("Error skipping to next track:", err);
      return handleSpotifyError(err);
    }
  },
};
